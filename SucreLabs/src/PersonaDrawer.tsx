import PersonaAvatar, { personaColor } from "./PersonaAvatar";

export type PersonaHistoryEntry = {
  roundLabel: string;
  text: string;
  confidence: number | null;
};

export default function PersonaDrawer({
  open,
  onClose,
  roleLabel,
  color,
  history,
}: {
  open: boolean;
  onClose: () => void;
  roleLabel: string;
  color: string;
  history: PersonaHistoryEntry[];
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full sm:w-[420px] h-full bg-[var(--color-panel)] border-l border-[var(--color-border)] flex flex-col">
        <div
          className="flex items-center gap-3 p-4 border-b border-[var(--color-border)]"
          style={{ borderTopColor: personaColor(color), borderTopWidth: 3 }}
        >
          <PersonaAvatar label={roleLabel} color={color} size={40} />
          <div className="flex-1">
            <div className="font-[family-name:var(--font-display)] text-lg">{roleLabel}</div>
            <div className="text-xs text-[var(--color-muted)]">Full perspective, all rounds</div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-muted)] hover:text-[var(--color-paper)] text-sm px-2 py-1"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {history.map((h, i) => (
            <div key={i} className="border-l-2 pl-3" style={{ borderColor: personaColor(color) }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
                  {h.roundLabel}
                </span>
                {h.confidence !== null && (
                  <span className="font-[family-name:var(--font-mono)] text-xs text-[var(--color-muted)]">
                    {h.confidence}/10
                  </span>
                )}
              </div>
              <div className="text-sm whitespace-pre-wrap">{h.text}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
