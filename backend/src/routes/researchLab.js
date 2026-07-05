import { Router } from "express";
import { randomUUID } from "crypto";
import { streamChatCompletion, chatCompletion } from "../lib/btlclient.js";
import { sanitizeModel } from "../lib/personas.js";
import {
  SECTION_DEFS,
  GENERATION_ORDER,
  DEFAULT_CONFIG,
  RESEARCH_NOTICE,
  buildReferencesPrompt,
  buildSectionPrompt,
  SECTION_ACTIONS,
  DOCUMENT_ACTIONS,
} from "../lib/researchLab.js";
import ResearchProject from "../models/ResearchProject.js";

const router = Router();
const TITLE_BY_ID = Object.fromEntries(SECTION_DEFS.map((s) => [s.id, s.title]));

/**
 * POST /api/research-lab/projects
 * body: { topic, config?, model }
 * Creates the project shell (draft status, empty sections) -- generation
 * happens as a separate step so the client can show the model picker and
 * config form before anything runs.
 */
router.post("/projects", async (req, res) => {
  const userid  = req.user.id;
  const { topic, config = {}, model } = req.body || {};
  if (!topic) return res.status(400).json({ error: "topic is required" });

  const project_id = randomUUID();
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const project = await ResearchProject.create({
    project_id,
    topic,
    title: topic,
    model: sanitizeModel(model),
    config: mergedConfig,
    user_id: userid,
    status: "draft",
    sections: SECTION_DEFS.map((s, i) => ({ section_id: s.id, title: s.title, content: "", order: i })),
  });

  res.json({ project_id: project.project_id });
});

/** GET /api/research-lab/projects -- list, most recently updated first. */
router.get("/projects", async (req, res) => {
  const userid  = req.user.id;
  const projects = await ResearchProject.find({ user_id: userid }, "project_id title topic status updated_at created_at").sort({
    updated_at: -1,
  });
  res.json({ projects });
});

/** GET /api/research-lab/projects/:id -- full project for the workspace. */
router.get("/projects/:id", async (req, res) => {
  const userid  = req.user.id;
  const project = await ResearchProject.findOne({ project_id: req.params.id, user_id: userid });
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json(project);
});

/** PATCH /api/research-lab/projects/:id -- rename or archive. */
router.patch("/projects/:id", async (req, res) => {
  const userid  = req.user.id;
  const { title, status } = req.body || {};
  const update = { updated_at: new Date() };
  if (title) update.title = title;
  if (status) update.status = status;

  const project = await ResearchProject.findOneAndUpdate(
    { project_id: req.params.id, user_id: userid },
    { $set: update },
    { new: true }
  );
  if (!project) return res.status(404).json({ error: "Project not found" });
  res.json(project);
});

/** DELETE /api/research-lab/projects/:id */
router.delete("/projects/:id", async (req, res) => {
  const userid  = req.user.id;
  await ResearchProject.deleteOne({ project_id: req.params.id, user_id: userid });
  res.json({ deleted: true });
});

/** POST /api/research-lab/projects/:id/duplicate */
router.post("/projects/:id/duplicate", async (req, res) => {
  const userid  = req.user.id;
  const original = await ResearchProject.findOne({ project_id: req.params.id, user_id: userid });
  if (!original) return res.status(404).json({ error: "Project not found" });

  const copy = original.toObject();
  delete copy._id;
  copy.project_id = randomUUID();
  copy.title = `${original.title} (copy)`;
  copy.created_at = new Date();
  copy.updated_at = new Date();

  const created = await ResearchProject.create(copy);
  res.json({ project_id: created.project_id });
});

/**
 * POST /api/research-lab/projects/:id/generate
 *
 * The core "living document" build: references first (so every later
 * section can cite from the same pool), then each section in order,
 * streamed token-by-token and persisted immediately as it finishes.
 * Emits "status" events with the phase text the spec calls for, so
 * generation feels deliberate rather than an instant wall of text.
 */
router.post("/projects/:id/generate", async (req, res) => {
  const project = await ResearchProject.findOne({ project_id: req.params.id });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    await ResearchProject.updateOne({ project_id: project.project_id }, { $set: { status: "generating" } });

    send("status", { text: "Searching trusted sources…" });
    send("notice", { text: RESEARCH_NOTICE });
    await ResearchProject.updateOne(
      { project_id: project.project_id },
      { $set: { research_notice: RESEARCH_NOTICE } }
    );

    send("status", { text: "Collecting references…" });
    const referencesText = await chatCompletion({
      model: project.model,
      temperature: 0.5,
      messages: [{ role: "user", content: buildReferencesPrompt(project.topic, project.config) }],
    });

    const referenceLines = referencesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const references = referenceLines.map((text, i) => ({ id: `ref-${i + 1}`, text }));

    await ResearchProject.updateOne({ project_id: project.project_id }, { $set: { references } });
    send("references_done", { references });

    send("status", { text: "Analyzing publications…" });

    for (const sectionId of GENERATION_ORDER) {
      if (sectionId === "references") continue; // already generated above
      const title = TITLE_BY_ID[sectionId];
      send("status", { text: `Writing ${title}…` });
      send("section_start", { section_id: sectionId });

      let content = "";
      try {
        content = await streamChatCompletion({
          model: project.model,
          messages: [
            {
              role: "user",
              content: buildSectionPrompt({
                sectionId,
                title,
                topic: project.topic,
                config: project.config,
                referencesText,
              }),
            },
          ],
          onToken: (delta) => send("token", { section_id: sectionId, delta }),
        });

        await ResearchProject.updateOne(
          { project_id: project.project_id, "sections.section_id": sectionId },
          { $set: { "sections.$.content": content, "sections.$.updated_at": new Date() } }
        );

        send("section_done", { section_id: sectionId, content });
      } catch (err) {
        send("section_error", { section_id: sectionId, message: err.message });
      }
    }

    send("status", { text: "Reviewing citations…" });
    await ResearchProject.updateOne(
      { project_id: project.project_id, "sections.section_id": "references" },
      { $set: { "sections.$.content": referencesText, "sections.$.updated_at": new Date() } }
    );
    send("section_done", { section_id: "references", content: referencesText });

    send("status", { text: "Formatting references…" });
    send("status", { text: "Finalizing document…" });

    await ResearchProject.updateOne(
      { project_id: project.project_id },
      { $set: { status: "ready", updated_at: new Date() } }
    );

    send("generation_done", {});
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

/**
 * POST /api/research-lab/projects/:id/assistant
 * body: { action, section_id?, instruction? }
 *
 * Section actions modify that section's content in place, preserving
 * everything else. Document actions produce a new derived output shown in
 * the assistant panel instead of editing the document, per the spec's
 * "modify only the requested sections unless instructed otherwise" rule.
 * "custom" uses the user's freeform instruction; targets a section if
 * section_id is given, otherwise the whole document as a derived output.
 */
router.post("/projects/:id/assistant", async (req, res) => {
  const { action, section_id, instruction } = req.body || {};
  const project = await ResearchProject.findOne({ project_id: req.params.id });
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const isSectionAction = SECTION_ACTIONS[action] || (action === "custom" && section_id);

    if (isSectionAction) {
      const section = project.sections.find((s) => s.section_id === section_id);
      if (!section) {
        send("error", { message: "Section not found" });
        return res.end();
      }

      const directive = action === "custom" ? instruction : SECTION_ACTIONS[action];
      let content = "";
      try {
        content = await streamChatCompletion({
          model: project.model,
          messages: [
            {
              role: "system",
              content: `You are editing one section ("${section.title}") of a research document on "${project.topic}". Apply the instruction below to this section's current content. Output ONLY the revised section content -- no heading, no commentary.`,
            },
            {
              role: "user",
              content: `Instruction: ${directive}\n\nCurrent content:\n${section.content}`,
            },
          ],
          onToken: (delta) => send("token", { section_id, delta }),
        });

        await ResearchProject.updateOne(
          { project_id: project.project_id, "sections.section_id": section_id },
          {
            $set: { "sections.$.content": content, "sections.$.updated_at": new Date(), updated_at: new Date() },
            $push: { edit_history: { action, section_id, note: directive } },
          }
        );

        send("section_done", { section_id, content });
      } catch (err) {
        send("error", { message: err.message });
      }
    } else {
      const directive = action === "custom" ? instruction : DOCUMENT_ACTIONS[action];
      if (!directive) {
        send("error", { message: `Unknown action: ${action}` });
        return res.end();
      }

      const fullDoc = project.sections.map((s) => `## ${s.title}\n${s.content}`).join("\n\n");
      let content = "";
      try {
        content = await streamChatCompletion({
          model: project.model,
          messages: [
            {
              role: "system",
              content: `You are a research assistant analyzing a full document on "${project.topic}". Apply the instruction below. Output ONLY the result -- no meta-commentary.`,
            },
            { role: "user", content: `Instruction: ${directive}\n\nDocument:\n${fullDoc}` },
          ],
          onToken: (delta) => send("token", { section_id: null, delta }),
        });

        await ResearchProject.updateOne(
          { project_id: project.project_id },
          {
            $push: {
              derived_outputs: { type: action, content },
              edit_history: { action, section_id: null, note: directive },
            },
            $set: { updated_at: new Date() },
          }
        );

        send("derived_done", { type: action, content });
      } catch (err) {
        send("error", { message: err.message });
      }
    }
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

/**
 * GET /api/research-lab/projects/:id/export?format=md|txt|docx
 */
router.get("/projects/:id/export", async (req, res) => {
  const format = (req.query.format || "md").toString();
  const project = await ResearchProject.findOne({ project_id: req.params.id });
  if (!project) return res.status(404).json({ error: "Project not found" });

  const title = project.title || project.topic;
  const ordered = [...project.sections].sort((a, b) => a.order - b.order);

  if (format === "md" || format === "txt") {
    const toc = ordered.map((s) => `- ${s.title}`).join("\n");
    const body = ordered.map((s) => `## ${s.title}\n\n${s.content}`).join("\n\n");
    const doc = `# ${title}\n\n## Table of Contents\n${toc}\n\n${body}\n`;

    const ext = format === "md" ? "md" : "txt";
    const mime = format === "md" ? "text/markdown" : "text/plain";
    res.setHeader("Content-Type", `${mime}; charset=utf-8`);
    res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(title)}.${ext}"`);
    return res.send(doc);
  }

  if (format === "docx") {
    try {
      const { Document, Packer, Paragraph, HeadingLevel } = await import("docx");
      const children = [
        new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
        new Paragraph({ text: "Table of Contents", heading: HeadingLevel.HEADING_2 }),
        ...ordered.map((s) => new Paragraph({ text: s.title, bullet: { level: 0 } })),
      ];
      for (const s of ordered) {
        children.push(new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }));
        for (const para of s.content.split("\n").filter(Boolean)) {
          children.push(new Paragraph({ text: para }));
        }
      }

      const doc = new Document({ sections: [{ children }] });
      const buffer = await Packer.toBuffer(doc);

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(title)}.docx"`);
      return res.send(buffer);
    } catch (err) {
      return res.status(500).json({ error: `docx export failed: ${err.message}` });
    }
  }

  if (format === "pdf") {
    try {
      const { default: PDFDocument } = await import("pdfkit");
      const doc = new PDFDocument({ margin: 54 });
      const chunks = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      const done = new Promise((resolve) => doc.on("end", resolve));

      doc.font("Helvetica-Bold").fontSize(22).text(title, { align: "center" });
      doc.moveDown(2);

      doc.font("Helvetica-Bold").fontSize(14).text("Table of Contents");
      doc.moveDown(0.5);
      doc.font("Helvetica").fontSize(11);
      ordered.forEach((s) => doc.text(`•  ${s.title}`));
      doc.addPage();

      ordered.forEach((s, i) => {
        if (i > 0) doc.moveDown(1.5);
        doc.font("Helvetica-Bold").fontSize(15).text(s.title);
        doc.moveDown(0.5);
        doc.font("Helvetica").fontSize(11).text(s.content || "", { align: "left", lineGap: 3 });
      });

      doc.end();
      await done;
      const buffer = Buffer.concat(chunks);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${sanitizeFilename(title)}.pdf"`);
      return res.send(buffer);
    } catch (err) {
      return res.status(500).json({ error: `pdf export failed: ${err.message}` });
    }
  }

  
  res.status(400).json({ error: `Unsupported format: ${format}. Supported: md, txt, docx, PDF .` });
});

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9\-_]+/gi, "_").slice(0, 80) || "research-document";
}

export default router;
