import { useState } from "react";
import { getSessionId, streamPersonaReply } from "./lib/api";

type Mode = "panel" | "research";

function NavRail() {
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col p-4 gap-6">
      <div className="font-[family-name:var(--font-display)] text-xl tracking-wide">
        SucreLab
      </div>
      <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
        Think Better. Research Deeper. Decide Smarter.
      </div>
      <div className="flex-1" />
      <div className="text-xs text-[var(--color-muted-alt)]">
        Recent sessions coming soon
      </div>
    </aside>
  );
}

export default function App() {
  const [mode, setMode] = useState<Mode>("panel");
  const [topic, setTopic] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [text, setText] = useState("");

  const sessionId = getSessionId();

  async function handleSubmit() {
    if (!topic.trim()) return;
    setText("");
    setStreaming(true);
    try {
      await streamPersonaReply({ session_id: sessionId, topic }, (delta) => {
        setText((t) => t + delta);
      });
    } catch (err) {
      setText((t) => t + `\n\n[error: ${(err as Error).message}]`);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div className="flex h-full">
      <NavRail />
      <main className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        <h1 className="font-[family-name:var(--font-display)] text-3xl text-center max-w-xl">
          What are you trying to think through?
        </h1>

        <div className="flex rounded-full border border-[var(--color-border)] overflow-hidden">
          <button
            onClick={() => setMode("panel")}
            className={`px-5 py-2 text-sm ${
              mode === "panel"
                ? "bg-[var(--color-teal)] text-[var(--color-ink)]"
                : "text-[var(--color-muted)]"
            }`}
          >
            Debate this
          </button>
          <button
            onClick={() => setMode("research")}
            className={`px-5 py-2 text-sm ${
              mode === "research"
                ? "bg-[var(--color-amber)] text-[var(--color-ink)]"
                : "text-[var(--color-muted)]"
            }`}
          >
            Research this
          </button>
        </div>

        <div className="w-full max-w-2xl flex flex-col gap-3">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Should we raise our Series A now or wait 6 months?"
            rows={3}
            className="w-full rounded-lg bg-[var(--color-panel-alt)] border border-[var(--color-border)] p-4 text-[var(--color-paper)] placeholder:text-[var(--color-muted-alt)] outline-none focus:border-[var(--color-teal)]"
          />
          <button
            onClick={handleSubmit}
            disabled={streaming}
            className="self-end rounded-full bg-[var(--color-teal)] text-[var(--color-ink)] px-6 py-2 text-sm font-medium disabled:opacity-50"
          >
            {streaming ? "Streaming…" : "Run streaming test call"}
          </button>
        </div>

        {text && (
          <div className="w-full max-w-2xl rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-4 font-[family-name:var(--font-mono)] text-sm whitespace-pre-wrap">
            {text}
          </div>
        )}
      </main>
    </div>
  );
}
