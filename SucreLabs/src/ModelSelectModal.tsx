import { useState } from "react";
import PersonaAvatar, { personaColor } from "./PersonaAvatar";
import { ALLOWED_MODELS, type ModelId } from "./lib/api";

export type PersonaOption = { persona_id: string; role_label: string; color: string };

const DEFAULT_MODEL: ModelId = "gpt-4.1-mini";

export default function ModelSelectModal({
  open,
  topic,
  category,
  personas,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  topic: string;
  category?: string;
  personas: PersonaOption[];
  onConfirm: (models: Record<string, ModelId>) => void;
  onCancel: () => void;
}) {
  const [selections, setSelections] = useState<Record<string, ModelId>>(() =>
    Object.fromEntries(personas.map((p) => [p.persona_id, DEFAULT_MODEL]))
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div className="relative w-full sm:max-w-md sm:rounded-lg rounded-t-2xl bg-[var(--color-panel)] border border-[var(--color-border)] p-5 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">Choose a model per persona</h2>
          <p className="text-xs text-[var(--color-muted)] mt-1 truncate">{topic}</p>
          {category && (
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-muted-alt)] mt-1">
              {category.replace(/_/g, " ")}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {personas.map((p) => (
            <div key={p.persona_id} className="flex items-center gap-3">
              <PersonaAvatar label={p.role_label} color={p.color} size={32} />
              <span className="text-sm flex-1" style={{ color: personaColor(p.color) }}>
                {p.role_label}
              </span>
              <select
                value={selections[p.persona_id]}
                onChange={(e) =>
                  setSelections((prev) => ({ ...prev, [p.persona_id]: e.target.value as ModelId }))
                }
                className="rounded-md bg-[var(--color-panel-alt)] border border-[var(--color-border)] text-sm px-2 py-1.5 outline-none focus:border-[var(--color-teal)]"
              >
                {ALLOWED_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button
            onClick={onCancel}
            className="rounded-full px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-paper)]"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(selections)}
            className="rounded-full bg-[var(--color-teal)] text-[var(--color-ink)] px-5 py-2 text-sm font-medium"
          >
            Start discussion
          </button>
        </div>
      </div>
    </div>
  );
}
