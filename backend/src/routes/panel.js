import { Router } from "express";
import { streamChatCompletion } from "../lib/btlclient.js";
import { ROSTER, selectPersonas } from "../lib/personas.js";
import Session from "../models/Session.js";
import Persona from "../models/Persona.js";

const router = Router();

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
  const { session_id, topic, model } = req.body || {};
  if (!session_id || !topic) {
    return res.status(400).json({ error: "session_id and topic are required" });
  }

  const { category, personaIds } = selectPersonas(topic);
  const usedModel = model || process.env.BTL_CHAT_MODEL || "gpt-4o-mini";

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
      })),
    });

    // Fire all 3 in parallel. Each writes its own tagged token events as
    // they arrive, and persists independently on completion, so the UI
    // never waits on the slowest persona.
    const tasks = personaIds.map(async (personaId) => {
      const persona = ROSTER[personaId];
      let fullText = "";
      try {
        fullText = await streamChatCompletion({
          model: usedModel,
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
            model: usedModel,
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

export default router;
