import Link from "next/link";

export function VibeMasthead({
  issueNumber,
  date,
}: {
  issueNumber: number;
  date: string;
}) {
  return (
    <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
      <Link href="/" className="display-italic text-[28px] tracking-tight">
        viber<span className="text-[var(--color-accent)]">.</span>
      </Link>
      <div className="flex items-baseline gap-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)]">
        <Link href="/" className="hover:text-[var(--color-accent)] transition-colors">
          ← back to issues
        </Link>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline tabular-nums">
          v.{String(issueNumber).padStart(3, "0")}
        </span>
        <span>·</span>
        <span className="tabular-nums">{date}</span>
      </div>
    </header>
  );
}
