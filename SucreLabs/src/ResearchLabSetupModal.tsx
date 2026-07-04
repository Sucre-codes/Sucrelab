import { useState } from "react";
import { ALLOWED_MODELS, CONFIG_DEFAULTS, type ModelId, type ResearchConfig } from "./lib/api";

const ACADEMIC_LEVELS = ["High School", "Undergraduate", "Graduate", "Doctoral", "Professional"];
const WRITING_STYLES = ["Academic", "Formal", "Conversational", "Technical", "Journalistic"];
const LENGTHS = ["Brief (800-1500 words)", "Standard (2500-3500 words)", "Extended (5000+ words)"];
const CITATION_STYLES = ["APA", "MLA", "Chicago", "IEEE", "Harvard"];
const LANGUAGES = ["English", "Spanish", "French", "German", "Portuguese", "Arabic", "Mandarin"];

export default function ResearchLabSetupModal({
  open,
  topic,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  topic: string;
  onConfirm: (config: ResearchConfig, model: ModelId) => void;
  onCancel: () => void;
}) {
  const [config, setConfig] = useState<ResearchConfig>({ ...CONFIG_DEFAULTS });
  const [model, setModel] = useState<ModelId>("gpt-4.1-mini");

  if (!open) return null;

  function field<K extends keyof ResearchConfig>(key: K, value: ResearchConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} aria-hidden />
      <div className="relative w-full sm:max-w-lg sm:rounded-lg rounded-t-2xl bg-[var(--color-panel)] border border-[var(--color-border)] p-5 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg">Set up your research document</h2>
          <p className="text-xs text-[var(--color-muted)] mt-1 truncate">{topic}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Academic level" value={config.academic_level} options={ACADEMIC_LEVELS} onChange={(v) => field("academic_level", v)} />
          <Select label="Writing style" value={config.writing_style} options={WRITING_STYLES} onChange={(v) => field("writing_style", v)} />
          <Select label="Length" value={config.length} options={LENGTHS} onChange={(v) => field("length", v)} />
          <Select label="Citation style" value={config.citation_style} options={CITATION_STYLES} onChange={(v) => field("citation_style", v)} />
          <Select label="Language" value={config.language} options={LANGUAGES} onChange={(v) => field("language", v)} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-muted)]">References</label>
            <input
              type="number"
              min={3}
              max={30}
              value={config.num_references}
              onChange={(e) => field("num_references", Number(e.target.value))}
              className="rounded-md bg-[var(--color-panel-alt)] border border-[var(--color-border)] text-sm px-2 py-1.5 outline-none focus:border-[var(--color-teal)]"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-[var(--color-muted)]">Target audience</label>
            <input
              value={config.audience}
              onChange={(e) => field("audience", e.target.value)}
              className="rounded-md bg-[var(--color-panel-alt)] border border-[var(--color-border)] text-sm px-2 py-1.5 outline-none focus:border-[var(--color-teal)]"
            />
          </div>
          <div className="col-span-2 flex flex-col gap-1">
            <label className="text-xs text-[var(--color-muted)]">Preferred publication year range</label>
            <input
              value={config.year_range}
              onChange={(e) => field("year_range", e.target.value)}
              className="rounded-md bg-[var(--color-panel-alt)] border border-[var(--color-border)] text-sm px-2 py-1.5 outline-none focus:border-[var(--color-teal)]"
            />
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] pt-3 flex items-center gap-3">
          <label className="text-sm flex-1">Research Assistant model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
            className="rounded-md bg-[var(--color-panel-alt)] border border-[var(--color-border)] text-sm px-2 py-1.5 outline-none focus:border-[var(--color-teal)]"
          >
            {ALLOWED_MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-[var(--color-muted)] hover:text-[var(--color-paper)]">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(config, model)}
            className="rounded-full bg-[var(--color-amber)] text-[var(--color-ink)] px-5 py-2 text-sm font-medium"
          >
            Generate document
          </button>
        </div>
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-[var(--color-muted)]">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md bg-[var(--color-panel-alt)] border border-[var(--color-border)] text-sm px-2 py-1.5 outline-none focus:border-[var(--color-teal)]"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
