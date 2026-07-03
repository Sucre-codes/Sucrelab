export function getSessionId(): string {
  const key = "sucrelab_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
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
