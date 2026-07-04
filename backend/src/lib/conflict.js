import { chatCompletion } from "./btlclient.js";

/**
 * BTL's runtime is OpenAI-compatible chat-completions only -- there is no
 * /v1/embeddings endpoint, so real embedding cosine similarity (our
 * original Round 2 approach) 404s. This replaces it with an LLM-as-judge
 * call: one chat-completion scores every pair of persona positions for
 * agreement (0 = total conflict, 1 = full agreement), returned as strict
 * JSON. It's still a real, non-hardcoded number driving who rebuts whom --
 * just judged by the model instead of computed from vectors.
 *
 * @param {{topic: string, docs: Array<{role_label:string, belief_state:string}>, model: string}} args
 * @returns {Promise<number[][]>} n x n symmetric matrix, 1 on diagonal
 */
export async function assessConflicts({ topic, docs, model }) {
  const n = docs.length;
  const fallback = () => {
    // Deterministic fallback so a bad/unparseable judge response never
    // breaks the round: pair each persona with the "next" one in a ring.
    const sim = Array.from({ length: n }, () => Array(n).fill(1));
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      sim[i][j] = 0.3;
      sim[j][i] = 0.3;
    }
    return sim;
  };

  if (n < 2) return Array.from({ length: n }, () => Array(n).fill(1));

  const list = docs
    .map((d, i) => `${i}. ${d.role_label}: ${d.belief_state}`)
    .join("\n\n");

  const prompt = `Topic: "${topic}"\n\nPanelist statements:\n${list}\n\nFor every unique pair of panelists (by index, a < b), score how much they agree on a 0 to 1 scale: 0 means they directly contradict each other, 1 means they fully agree. Respond with ONLY strict JSON in exactly this shape, no markdown fences, no prose:\n{"pairs":[{"a":0,"b":1,"agreement":0.4}]}\nInclude every unique pair exactly once.`;

  try {
    const raw = await chatCompletion({
      model,
      temperature: 0,
      messages: [
        { role: "system", content: "You output only strict JSON. Never include markdown or prose." },
        { role: "user", content: prompt },
      ],
    });

    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed.pairs)) throw new Error("malformed judge response");

    const sim = Array.from({ length: n }, () => Array(n).fill(1));
    for (const p of parsed.pairs) {
      if (
        typeof p.a === "number" &&
        typeof p.b === "number" &&
        typeof p.agreement === "number" &&
        p.a >= 0 && p.a < n && p.b >= 0 && p.b < n
      ) {
        sim[p.a][p.b] = p.agreement;
        sim[p.b][p.a] = p.agreement;
      }
    }
    return sim;
  } catch (err) {
    console.warn("[conflict] judge call failed, using fallback pairing:", err.message);
    return fallback();
  }
}
