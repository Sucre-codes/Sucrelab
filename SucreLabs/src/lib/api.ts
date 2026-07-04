export function getSessionId(): string {
  const key = "sucrelab_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export type PersonaMeta = { persona_id: string; role_label: string; color: string; model?: string };

export type Round1Handlers = {
  onMeta?: (data: { category: string; personas: PersonaMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onError?: (message: string) => void;
};

export const ALLOWED_MODELS = [ "gpt-4.1-mini","btl-2", "grok-build-0.1", "deepseek-v4-flash"] as const;
export type ModelId = (typeof ALLOWED_MODELS)[number];

export async function resolvePersonas(topic: string): Promise<{
  category: string;
  personas: { persona_id: string; role_label: string; color: string }[];
}> {
  const res = await fetch("/api/panel/personas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic }),
  });
  if (!res.ok) throw new Error("Failed to resolve personas for this topic");
  return res.json();
}

export async function streamRound1(
  { session_id, topic, persona_models }: { session_id: string; topic: string; persona_models: Record<string, ModelId> },
  handlers: Round1Handlers
): Promise<void> {
  const res = await fetch("/api/panel/round1", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic, persona_models }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export type SimilarityMeta = { persona_id: string; conflicts_with: string | null; similarity: number };

export type Round2Handlers = {
  onMeta?: (data: { round: number; similarity_matrix: SimilarityMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onError?: (message: string) => void;
};

export async function streamRound2(
  { session_id, topic }: { session_id: string; topic: string },
  handlers: Round2Handlers
): Promise<void> {
  const res = await fetch("/api/panel/round2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export type FollowupHandlers = {
  onMeta?: (data: { personas: PersonaMeta[] }) => void;
  onToken?: (data: { persona_id: string; delta: string }) => void;
  onPersonaDone?: (data: { persona_id: string; fullText: string; confidence: number | null }) => void;
  onPersonaError?: (data: { persona_id: string; message: string }) => void;
  onRoundDone?: () => void;
  onError?: (message: string) => void;
};

export async function streamFollowup(
  { session_id, topic, question }: { session_id: string; topic: string; question: string },
  handlers: FollowupHandlers
): Promise<void> {
  const res = await fetch("/api/panel/followup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic, question }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      switch (event) {
        case "meta":
          handlers.onMeta?.(data);
          break;
        case "token":
          handlers.onToken?.(data);
          break;
        case "persona_done":
          handlers.onPersonaDone?.(data);
          break;
        case "persona_error":
          handlers.onPersonaError?.(data);
          break;
        case "round_done":
          handlers.onRoundDone?.();
          break;
        case "error":
          handlers.onError?.(data.message);
          break;
      }
    }
  }
}

export async function streamPersonaReply(
  { session_id, topic }: { session_id: string; topic: string },
  onToken: (delta: string) => void
): Promise<string> {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id, topic }),
  });

  if (!res.body) throw new Error("No response body (streaming unsupported)");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!dataLine) continue;
      const event = eventLine?.slice(6).trim();
      const data = JSON.parse(dataLine.slice(5).trim());

      if (event === "token") {
        full += data.delta;
        onToken(data.delta);
      } else if (event === "error") {
        throw new Error(data.message);
      }
    }
  }

  return full;
}
