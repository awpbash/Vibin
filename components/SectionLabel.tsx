export function SectionLabel({
  num,
  children,
}: {
  num?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3 mb-5">
      {num ? (
        <span className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-[var(--color-ink-faint)]">
          {num}
        </span>
      ) : null}
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-mute)]">
        {children}
      </span>
    </div>
  );
}
