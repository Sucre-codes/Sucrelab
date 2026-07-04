import PersonaAvatar, { personaColor } from "./PersonaAvatar";
import type { PositionsResponse } from "./lib/api";

function Sparkline({ scores, color }: { scores: (number | null)[]; color: string }) {
  const valid = scores.filter((s): s is number => s != null);
  if (valid.length === 0) return null;

  const w = 160;
  const h = 36;
  const max = 10;
  const step = valid.length > 1 ? w / (valid.length - 1) : 0;
  const points = valid.map((s, i) => `${i * step},${h - (s / max) * h}`).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
      {valid.map((s, i) => (
        <circle key={i} cx={i * step} cy={h - (s / max) * h} r={3} fill={color} />
      ))}
    </svg>
  );
}

export default function CurrentPositionsPanel({
  open,
  onClose,
  data,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  data: PositionsResponse | null;
  loading: boolean;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div className="relative w-full sm:w-[480px] h-full bg-[var(--color-panel)] border-l border-[var(--color-border)] flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border)]">
          <div className="flex-1">
            <div className="font-[family-name:var(--font-display)] text-lg">Current Positions</div>
            <div className="text-xs text-[var(--color-muted)]">Confidence trend across rounds</div>
          </div>
          <button onClick={onClose} className="text-[var(--color-muted)] hover:text-[var(--color-paper)] text-sm px-2 py-1">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          {loading && <div className="text-sm text-[var(--color-muted)]">Loading…</div>}

          {data?.moderator_summary && (
            <div className="rounded-lg border border-[var(--color-border-alt)] bg-[var(--color-panel-alt)] p-4">
              <div className="text-xs uppercase tracking-widest text-[var(--color-paper)] mb-2">
                Moderator's synthesis
              </div>
              <div className="text-sm whitespace-pre-wrap">{data.moderator_summary}</div>
            </div>
          )}

          {data?.personas.map((p) => {
            const color = personaColor(p.color);
            const latest = p.current_position[p.current_position.length - 1];
            const latestConfidence = p.confidence_history[p.confidence_history.length - 1]?.score ?? null;

            return (
              <div key={p.persona_id} className="border-l-2 pl-3" style={{ borderColor: color }}>
                <div className="flex items-center gap-2 mb-2">
                  <PersonaAvatar label={p.role_label} color={p.color} size={28} />
                  <span className="text-sm font-medium">{p.role_label}</span>
                  <span className="font-[family-name:var(--font-mono)] text-[10px] text-[var(--color-muted-alt)]">
                    {p.model}
                  </span>
                </div>

                <div className="flex items-center gap-3 mb-2">
                  <Sparkline scores={p.confidence_history.map((c) => c.score)} color={color} />
                  {latestConfidence != null && (
                    <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
                      now at {latestConfidence}/10
                    </span>
                  )}
                </div>

                {latest && <div className="text-sm text-[var(--color-paper)]">{latest}</div>}
              </div>
            );
          })}

          {!loading && !data?.personas.length && (
            <div className="text-sm text-[var(--color-muted-alt)]">No positions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
