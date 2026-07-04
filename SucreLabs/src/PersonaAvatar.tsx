const COLOR_MAP: Record<string, string> = {
  teal: "var(--color-teal)",
  amber: "var(--color-amber)",
  muted: "var(--color-muted)",
};

export function personaColor(color: string): string {
  return COLOR_MAP[color] || COLOR_MAP.muted;
}

export default function PersonaAvatar({
  label,
  color,
  size = 36,
}: {
  label: string;
  color: string;
  size?: number;
}) {
  const initial = label.trim().charAt(0).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-[family-name:var(--font-display)] font-semibold"
      style={{
        width: size,
        height: size,
        backgroundColor: personaColor(color),
        color: "var(--color-ink)",
        fontSize: size * 0.42,
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}
