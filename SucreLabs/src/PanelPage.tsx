import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  streamRound1,
  streamRound2,
  streamFollowup,
  type PersonaMeta,
  type SimilarityMeta,
  type ModelId,
} from "./lib/api";
import PersonaAvatar, { personaColor } from "./PersonaAvatar";
import PersonaDrawer, { type PersonaHistoryEntry } from "./PersonaDrawer";

type RoundTag = 1 | 2 | `followup-${number}`;

type ChatEntry = {
  id: string;
  kind: "persona" | "user" | "divider";
  personaId?: string;
  roundTag?: RoundTag;
  roundLabel?: string;
  text: string;
  confidence?: number | null;
  streaming?: boolean;
};

function roundLabelFor(tag: RoundTag): string {
  if (tag === 1) return "Round 1 — opening position";
  if (tag === 2) return "Round 2 — rebuttal";
  return "Follow-up";
}

export default function PanelPage() {
  const { session_id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const topic = searchParams.get("topic") || "";
  const personaModels: Record<string, ModelId> = (() => {
    try {
      return JSON.parse(searchParams.get("models") || "{}");
    } catch {
      return {};
    }
  })();

  const [category, setCategory] = useState("");
  const [personasMeta, setPersonasMeta] = useState<Record<string, PersonaMeta>>({});
  const [conflicts, setConflicts] = useState<SimilarityMeta[]>([]);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState("Personas are forming their independent opinions…");
  const [followupEnabled, setFollowupEnabled] = useState(false);
  const [followupText, setFollowupText] = useState("");
  const [followupSending, setFollowupSending] = useState(false);
  const [followupCount, setFollowupCount] = useState(0);
  const [drawerPersonaId, setDrawerPersonaId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const started = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function upsertToken(personaId: string, roundTag: RoundTag, delta: string) {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.personaId === personaId && m.roundTag === roundTag);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], text: next[idx].text + delta };
      return next;
    });
  }

  function markDone(personaId: string, roundTag: RoundTag, confidence: number | null) {
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.personaId === personaId && m.roundTag === roundTag);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], streaming: false, confidence };
      return next;
    });
  }

  useEffect(() => {
    if (!topic || started.current) return;
    started.current = true;

    async function run() {
      await streamRound1(
        { session_id, topic, persona_models: personaModels },
        {
          onMeta: ({ category, personas }) => {
            setCategory(category);
            const metaMap: Record<string, PersonaMeta> = {};
            personas.forEach((p) => (metaMap[p.persona_id] = p));
            setPersonasMeta(metaMap);
            setMessages(
              personas.map((p) => ({
                id: `${p.persona_id}-1`,
                kind: "persona",
                personaId: p.persona_id,
                roundTag: 1,
                roundLabel: roundLabelFor(1),
                text: "",
                confidence: null,
                streaming: true,
              }))
            );
          },
          onToken: ({ persona_id, delta }) => upsertToken(persona_id, 1, delta),
          onPersonaDone: ({ persona_id, confidence }) => markDone(persona_id, 1, confidence),
          onPersonaError: ({ persona_id, message }) =>
            upsertToken(persona_id, 1, `\n[error: ${message}]`),
          onRoundDone: () => setStatus("Round 1 complete. Finding sharpest disagreements…"),
          onError: (message) => setStatus(`Error: ${message}`),
        }
      );

      setMessages((prev) => [
        ...prev,
        { id: "divider-2", kind: "divider", text: "Round 2 — panelists respond to each other" },
      ]);

      await streamRound2(
        { session_id, topic },
        {
          onMeta: ({ similarity_matrix }) => {
            setConflicts(similarity_matrix);
            setStatus("Round 2: panelists are engaging their sharpest disagreement…");
            setMessages((prev) => [
              ...prev,
              ...similarity_matrix.map((s) => ({
                id: `${s.persona_id}-2`,
                kind: "persona" as const,
                personaId: s.persona_id,
                roundTag: 2 as RoundTag,
                roundLabel: roundLabelFor(2),
                text: "",
                confidence: null,
                streaming: true,
              })),
            ]);
          },
          onToken: ({ persona_id, delta }) => upsertToken(persona_id, 2, delta),
          onPersonaDone: ({ persona_id, confidence }) => markDone(persona_id, 2, confidence),
          onPersonaError: ({ persona_id, message }) =>
            upsertToken(persona_id, 2, `\n[error: ${message}]`),
          onRoundDone: () => {
            setStatus("Discussion complete. Ask a follow-up to keep going.");
            setFollowupEnabled(true);
          },
          onError: (message) => setStatus(`Error: ${message}`),
        }
      );
    }

    run();
  }, [session_id, topic]);

  async function handleFollowupSubmit() {
    const question = followupText.trim();
    if (!question || followupSending) return;

    const n = followupCount + 1;
    const tag: RoundTag = `followup-${n}`;
    setFollowupCount(n);
    setFollowupText("");
    setFollowupSending(true);
    setFollowupEnabled(false);

    setMessages((prev) => [
      ...prev,
      { id: `user-${n}`, kind: "user", text: question },
    ]);

    try {
      await streamFollowup(
        { session_id, topic, question },
        {
          onMeta: ({ personas }) => {
            setMessages((prev) => [
              ...prev,
              ...personas.map((p) => ({
                id: `${p.persona_id}-${tag}`,
                kind: "persona" as const,
                personaId: p.persona_id,
                roundTag: tag,
                roundLabel: roundLabelFor(tag),
                text: "",
                confidence: null,
                streaming: true,
              })),
            ]);
          },
          onToken: ({ persona_id, delta }) => upsertToken(persona_id, tag, delta),
          onPersonaDone: ({ persona_id, confidence }) => markDone(persona_id, tag, confidence),
          onPersonaError: ({ persona_id, message }) =>
            upsertToken(persona_id, tag, `\n[error: ${message}]`),
          onRoundDone: () => setStatus("Ask another follow-up any time."),
          onError: (message) => setStatus(`Error: ${message}`),
        }
      );
    } finally {
      setFollowupSending(false);
      setFollowupEnabled(true);
    }
  }

  function conflictLabelFor(personaId: string): string | null {
    const c = conflicts.find((c) => c.persona_id === personaId);
    if (!c?.conflicts_with) return null;
    const partner = personasMeta[c.conflicts_with]?.role_label;
    return partner ? `rebutting ${partner} · agreement ${c.similarity}` : null;
  }

  function historyFor(personaId: string): PersonaHistoryEntry[] {
    return messages
      .filter((m) => m.kind === "persona" && m.personaId === personaId)
      .map((m) => ({
        roundLabel: m.roundLabel || "",
        text: m.text,
        confidence: m.confidence ?? null,
      }));
  }

  const drawerMeta = drawerPersonaId ? personasMeta[drawerPersonaId] : null;

  return (
    <div className="flex h-full relative">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar: overlay on mobile, static column on desktop */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-panel)] flex flex-col p-4 gap-6 transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="font-[family-name:var(--font-display)] text-xl tracking-wide">
          SucreLab
        </div>
        {category && (
          <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
            {category.replace(/_/g, " ")}
          </div>
        )}
        <div className="flex flex-col gap-2">
          {Object.values(personasMeta).map((p) => (
            <button
              key={p.persona_id}
              onClick={() => setDrawerPersonaId(p.persona_id)}
              className="flex items-center gap-2 text-left text-sm px-2 py-2 rounded hover:bg-[var(--color-panel-alt)]"
            >
              <PersonaAvatar label={p.role_label} color={p.color} size={28} />
              {p.role_label}
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border)]">
          <button
            className="md:hidden text-[var(--color-paper)]"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="font-[family-name:var(--font-display)] text-lg truncate">{topic}</h1>
            <p className="text-xs text-[var(--color-muted)]">{status}</p>
          </div>
        </div>

        {/* Chat thread */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {messages.map((m) => {
            if (m.kind === "divider") {
              return (
                <div key={m.id} className="text-center text-xs uppercase tracking-widest text-[var(--color-muted-alt)] py-2">
                  {m.text}
                </div>
              );
            }
            if (m.kind === "user") {
              return (
                <div key={m.id} className="self-end max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-sm bg-[var(--color-teal)] text-[var(--color-ink)] px-4 py-2 text-sm">
                  {m.text}
                </div>
              );
            }
            const meta = m.personaId ? personasMeta[m.personaId] : null;
            if (!meta) return null;
            const conflictLabel = m.roundTag === 2 && m.personaId ? conflictLabelFor(m.personaId) : null;

            return (
              <div key={m.id} className="flex items-start gap-3 max-w-[95%] sm:max-w-[75%]">
                <PersonaAvatar label={meta.role_label} color={meta.color} />
                <div
                  className="rounded-2xl rounded-tl-sm bg-[var(--color-panel)] border border-[var(--color-border)] px-4 py-3 flex-1"
                  style={{ borderLeftColor: personaColor(meta.color), borderLeftWidth: 3 }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {meta.role_label}
                      {meta.model && (
                        <span className="ml-2 font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-muted-alt)]">
                          {meta.model}
                        </span>
                      )}
                    </span>
                    {m.confidence != null && (
                      <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
                        {m.confidence}/10
                      </span>
                    )}
                  </div>
                  {conflictLabel && (
                    <div className="text-[10px] uppercase tracking-widest text-[var(--color-amber)] mb-1">
                      {conflictLabel}
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap line-clamp-4">
                    {m.text || <span className="text-[var(--color-muted-alt)]">thinking…</span>}
                  </div>
                  {m.text.length > 0 && (
                    <button
                      onClick={() => setDrawerPersonaId(meta.persona_id)}
                      className="mt-1 text-xs text-[var(--color-teal)] hover:underline"
                    >
                      View full perspective →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Follow-up input */}
        <div className="border-t border-[var(--color-border)] p-3 flex gap-2">
          <input
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleFollowupSubmit()}
            disabled={!followupEnabled}
            placeholder={
              followupEnabled ? "Ask a follow-up…" : "Waiting for the discussion to finish…"
            }
            className="flex-1 rounded-full bg-[var(--color-panel-alt)] border border-[var(--color-border)] px-4 py-2 text-sm outline-none focus:border-[var(--color-teal)] disabled:opacity-50"
          />
          <button
            onClick={handleFollowupSubmit}
            disabled={!followupEnabled || !followupText.trim()}
            className="rounded-full bg-[var(--color-teal)] text-[var(--color-ink)] px-5 py-2 text-sm font-medium disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </main>

      {drawerMeta && (
        <PersonaDrawer
          open={!!drawerPersonaId}
          onClose={() => setDrawerPersonaId(null)}
          roleLabel={drawerMeta.role_label}
          color={drawerMeta.color}
          history={historyFor(drawerMeta.persona_id)}
        />
      )}
    </div>
  );
}
