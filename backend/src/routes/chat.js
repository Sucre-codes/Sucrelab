import { Router } from "express";
import { streamChatCompletion } from "../lib/btlclient.js";
import { sanitizeModel } from "../lib/personas.js";
import Session from "../models/Session.js";
import Persona from "../models/Persona.js";

const router = Router();

/**
 * POST /api/chat/stream
 * body: { session_id, topic, persona_id?, role_label?, model? }
 *
 * This is the 0-4h milestone: one real, non-simulated streaming call from
 * the BTL runtime, wired end to end through Express -> SSE -> and persisted
 * to Mongo (Session + Persona docs) so we've proven the whole spine before
 * building the 3-persona Round 1/2/3 orchestration on top of it.
 */
router.post("/stream", async (req, res) => {
  const {
    session_id,
    topic,
    persona_id = "optimist",
    role_label = "Optimist",
    model,
  } = req.body || {};

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
    await Session.updateOne(
      { session_id },
      { $setOnInsert: { session_id, mode: "panel", topic } },
      { upsert: true }
    );

    const usedModel = sanitizeModel(model);

    let fullText = "";
    fullText = await streamChatCompletion({
      model: usedModel,
      messages: [
        {
          role: "system",
          content: `You are the "${role_label}" persona in a structured debate panel called SucreLab. Give your independent opinion on the topic in 3-5 sentences, then on a new line write "Confidence: N/10" with a brief reason.`,
        },
        { role: "user", content: `Topic: ${topic}` },
      ],
      onToken: (delta) => send("token", { delta }),
    });

    await Persona.findOneAndUpdate(
      { session_id, persona_id },
      {
        session_id,
        persona_id,
        role_label,
        model: usedModel,
        current_position: [fullText.split("\n")[0]],
        belief_state: fullText,
        $push: {
          confidence_history: { round: 1, score: 0, reason: "initial" },
        },
        updated_at: new Date(),
      },
      { upsert: true }
    );

    send("done", { fullText });
  } catch (err) {
    send("error", { message: err.message });
  } finally {
    res.end();
  }
});

export default router;
