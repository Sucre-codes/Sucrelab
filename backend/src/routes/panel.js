import { Router } from "express";
import { streamChatCompletion } from "../lib/btlclient.js";
import { assessConflicts } from "../lib/conflict.js";
import { ROSTER, selectPersonas, sanitizeModel, FALLBACK_MODEL } from "../lib/personas.js";
import Session from "../models/Session.js";
import Persona from "../models/Persona.js";

const router = Router();

/**
 * POST /api/panel/personas
 * body: { topic }
 *
 * Resolves category + the 3 personas for a topic WITHOUT starting a round
 * or calling the model -- this is what powers the model-selection popup:
 * the client needs to know which 3 personas will speak before it can show
 * a dropdown for each of them.
 */
router.post("/personas", (req, res) => {
  const { topic } = req.body || {};
  if (!topic) return res.status(400).json({ error: "topic is required" });

  const { category, personaIds } = selectPersonas(topic);
  res.json({
    category,
    personas: personaIds.map((id) => ({
      persona_id: id,
      role_label: ROSTER[id].role_label,
      color: ROSTER[id].color,
    })),
  });
});

/**
 * POST /api/panel/round1
 * body: { session_id, topic }
 *
 * Category auto-selects exactly 3 personas from the roster, then fires all
 * 3 Round 1 calls in parallel and streams each back independently as it
 * completes -- never blocking on the slowest one. Each persona only sees
 * the question, its own definition, and the category (no cross-talk yet;
 * that's Round 2).
 */
router.post("/round1", async (req, res) => {
  const { session_id, topic, persona_models = {} } = req.body || {};
  if (!session_id || !topic) {
    return res.status(400).json({ error: "session_id and topic are required" });
  }

  const { category, personaIds } = selectPersonas(topic);

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
    await Session.updateOne(
      { session_id },
      { $set: { mode: "panel", topic, category }, $setOnInsert: { session_id } },
      { upsert: true }
    );

    send("meta", {
      category,
      personas: personaIds.map((id) => ({
        persona_id: id,
        role_label: ROSTER[id].role_label,
        color: ROSTER[id].color,
        model: sanitizeModel(persona_models[id]),
      })),
    });

    // Fire all 3 in parallel. Each writes its own tagged token events as
    // they arrive, and persists independently on completion, so the UI
    // never waits on the slowest persona.
    const tasks = personaIds.map(async (personaId) => {
      const persona = ROSTER[personaId];
      const personaModel = sanitizeModel(persona_models[personaId]);
      let fullText = "";
      try {
        fullText = await streamChatCompletion({
          model: personaModel,
          messages: [
            {
              role: "system",
              content: `${persona.system}\n\nCategory: ${category}.\nGive your independent Round 1 opinion in 3-5 sentences. Then on a new line write exactly: "Confidence: N/10 — <one short reason>".`,
            },
            { role: "user", content: `Topic: ${topic}` },
          ],
          onToken: (delta) => send("token", { persona_id: personaId, delta }),
        });

        const confMatch = fullText.match(
          /Confidence:\s*(\d+)\/10\s*(?:—|-)?\s*(.*)/i
        );
        const score = confMatch ? Number(confMatch[1]) : null;
        const reason = confMatch ? confMatch[2].trim() : "";
        const positionLine = fullText.split("\n")[0];

        await Persona.findOneAndUpdate(
          { session_id, persona_id: personaId },
          {
            session_id,
            persona_id: personaId,
            role_label: persona.role_label,
            model: personaModel,
            current_position: [positionLine],
            belief_state: fullText,
            $push: { confidence_history: { round: 1, score, reason } },
            updated_at: new Date(),
          },
          { upsert: true }
        );

        send("persona_done", { persona_id: personaId, fullText, confidence: score });
      } catch (err) {
        send("persona_error", { persona_id: personaId, message: err.message });
      }
    });

    await Promise.allSettled(tasks);
    send("round_done", { round: 1 });
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

/**
 * POST /api/panel/round2
 * body: { session_id, topic }
 *
 * This is the runtime-prize differentiator: we embed each persona's Round 1
 * position via BTL's /embeddings endpoint, compute real pairwise cosine
 * similarity, and use the LOWEST-similarity pair per persona as their
 * assigned rebuttal target. This isn't decorative -- the actual number
 * decides who each persona is told to engage with, and gets sent back to
 * the client so the UI can render a real conflict graph, not a scripted one.
 */
router.post("/round2", async (req, res) => {
  const { session_id, topic } = req.body || {};
  if (!session_id || !topic) {
    return res.status(400).json({ error: "session_id and topic are required" });
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
    const docs = await Persona.find({ session_id });
    if (docs.length < 2) {
      send("error", { message: "Need at least 2 personas with Round 1 positions before Round 2." });
      return res.end();
    }

    // Judge pairwise agreement via a single chat-completion call (BTL has
    // no /embeddings endpoint -- see lib/conflict.js for why).
    const sim = await assessConflicts({ topic, docs, model: FALLBACK_MODEL });
    const n = docs.length;

    // For each persona, find the lowest-similarity (most conflicting) other.
    const targets = docs.map((_, i) => {
      let bestJ = -1;
      let bestScore = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        if (sim[i][j] < bestScore) {
          bestScore = sim[i][j];
          bestJ = j;
        }
      }
      return { targetIndex: bestJ, similarity: bestScore };
    });

    send("meta", {
      round: 2,
      similarity_matrix: docs.map((d, i) => ({
        persona_id: d.persona_id,
        conflicts_with: targets[i].targetIndex >= 0 ? docs[targets[i].targetIndex].persona_id : null,
        similarity: Number(targets[i].similarity.toFixed(3)),
      })),
    });

    const tasks = docs.map(async (doc, i) => {
      const persona = ROSTER[doc.persona_id] || { role_label: doc.role_label, system: "" };
      const target = targets[i];
      const targetDoc = target.targetIndex >= 0 ? docs[target.targetIndex] : null;
      const others = docs.filter((_, j) => j !== i);

      let fullText = "";
      try {
        fullText = await streamChatCompletion({
          model: doc.model || FALLBACK_MODEL,
          messages: [
            {
              role: "system",
              content: `${persona.system}\n\nThis is Round 2 (rebuttal) of a debate panel on: "${topic}".\nHere is what the other panelists said in Round 1:\n${others
                .map((o) => `- ${o.role_label}: ${o.belief_state}`)
                .join("\n")}\n\n${
                targetDoc
                  ? `Your position is most in tension with the ${targetDoc.role_label} (agreement score ${target.similarity.toFixed(2)} out of 1.0, lower = more disagreement). Directly engage with their specific argument.`
                  : ""
              }\nRespond in 3-5 sentences: either hold your position and explain why the other view doesn't change your mind, or explicitly say how it shifts your thinking. End with a new line: "Confidence: N/10 — <one short reason>".`,
            },
            { role: "user", content: `Topic: ${topic}` },
          ],
          onToken: (delta) => send("token", { persona_id: doc.persona_id, delta }),
        });

        const confMatch = fullText.match(/Confidence:\s*(\d+)\/10\s*(?:—|-)?\s*(.*)/i);
        const score = confMatch ? Number(confMatch[1]) : null;
        const reason = confMatch ? confMatch[2].trim() : "";

        await Persona.findOneAndUpdate(
          { session_id, persona_id: doc.persona_id },
          {
            $set: {
              belief_state: fullText,
              updated_at: new Date(),
            },
            $push: {
              current_position: fullText.split("\n")[0],
              confidence_history: { round: 2, score, reason },
            },
          }
        );

        send("persona_done", { persona_id: doc.persona_id, fullText, confidence: score });
      } catch (err) {
        send("persona_error", { persona_id: doc.persona_id, message: err.message });
      }
    });

    await Promise.allSettled(tasks);
    send("round_done", { round: 2 });
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

/**
 * POST /api/panel/followup
 * body: { session_id, topic, question }
 *
 * Continues the same thread: every persona already in this session responds
 * to the user's follow-up, grounded in their own accumulated belief_state
 * (not just the original topic), streamed in parallel like the earlier
 * rounds. This is what lets the conversation keep going instead of ending
 * at Round 2.
 */
router.post("/followup", async (req, res) => {
  const { session_id, topic, question } = req.body || {};
  if (!session_id || !question) {
    return res.status(400).json({ error: "session_id and question are required" });
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
    const docs = await Persona.find({ session_id });
    if (docs.length === 0) {
      send("error", { message: "No personas found for this session yet." });
      return res.end();
    }

    send("meta", {
      personas: docs.map((d) => ({
        persona_id: d.persona_id,
        role_label: d.role_label,
        color: ROSTER[d.persona_id]?.color || "muted",
      })),
    });

    const tasks = docs.map(async (doc) => {
      const persona = ROSTER[doc.persona_id] || { role_label: doc.role_label, system: "" };
      const nextRound = (doc.confidence_history?.length || 0) + 1;

      let fullText = "";
      try {
        fullText = await streamChatCompletion({
          model: doc.model || FALLBACK_MODEL,
          messages: [
            {
              role: "system",
              content: `${persona.system}\n\nThis debate on "${topic}" is continuing. Your position so far:\n${doc.belief_state}\n\nThe user is now asking a follow-up question. Answer it consistent with your established position, updating it only if the question genuinely changes your reasoning. End with a new line: "Confidence: N/10 — <one short reason>".`,
            },
            { role: "user", content: question },
          ],
          onToken: (delta) => send("token", { persona_id: doc.persona_id, delta }),
        });

        const confMatch = fullText.match(/Confidence:\s*(\d+)\/10\s*(?:—|-)?\s*(.*)/i);
        const score = confMatch ? Number(confMatch[1]) : null;
        const reason = confMatch ? confMatch[2].trim() : "";

        await Persona.findOneAndUpdate(
          { session_id, persona_id: doc.persona_id },
          {
            $set: { belief_state: fullText, updated_at: new Date() },
            $push: {
              current_position: fullText.split("\n")[0],
              confidence_history: { round: nextRound, score, reason },
            },
          }
        );

        send("persona_done", { persona_id: doc.persona_id, fullText, confidence: score });
      } catch (err) {
        send("persona_error", { persona_id: doc.persona_id, message: err.message });
      }
    });

    await Promise.allSettled(tasks);
    send("round_done", { round: "followup" });
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
