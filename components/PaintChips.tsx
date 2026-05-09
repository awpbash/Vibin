import type { VibeObject } from "@/lib/types";

export function PaintChips({ palette }: { palette: VibeObject["palette"] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-5 lg:gap-7">
      {palette.map((c, i) => (
        <article
          key={c.hex}
          className="reveal"
          style={{ animationDelay: `${200 + i * 80}ms` }}
        >
          <div
            className="paint-chip aspect-[4/5]"
            style={{ ["--chip" as string]: c.hex }}
          />
          <div className="paint-chip-tab px-3 py-2 flex items-baseline justify-between">
            <span className="display-italic text-[15px] text-[var(--color-ink)]">
              {c.name}
            </span>
            <span className="font-mono text-[10px] uppercase text-[var(--color-ink-faint)] tabular-nums">
              {c.hex.toUpperCase()}
            </span>
          </div>
          <div className="caption mt-2 ml-1 tabular-nums">
            {String(i + 1).padStart(2, "0")} / {String(palette.length).padStart(2, "0")}
          </div>
        </article>
      ))}
    </div>
  );
}
