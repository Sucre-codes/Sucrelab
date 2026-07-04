export default function Logo({
  size = 36,
  glow = true,
  withWordmark = true,
  onClick,
}: {
  size?: number;
  glow?: boolean;
  withWordmark?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2.5 text-left ${onClick ? "cursor-pointer" : "cursor-default"}`}
      aria-label="SucreLab home"
    >
      <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        {glow && (
          <span
            className="absolute inset-[-40%] rounded-full blur-lg opacity-60"
            style={{
              background:
                "radial-gradient(circle, var(--color-teal) 0%, transparent 70%)",
            }}
            aria-hidden
          />
        )}
        <img src="/logo.png" alt="" className="relative w-full h-full object-contain" />
      </span>
      {withWordmark && (
        <span className="font-[family-name:var(--font-display)] tracking-wide" style={{ fontSize: size * 0.5 }}>
          SucreLab
        </span>
      )}
    </button>
  );
}
