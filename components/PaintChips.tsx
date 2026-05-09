import type { VibeObject } from "@/lib/types";

export function PaintChips({ palette }: { palette: VibeObject["palette"] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 max-w-[640px]">
      {palette.map((c, i) => (
        <article
          key={c.hex}
          className="reveal"
          style={{ animationDelay: `${200 + i * 80}ms` }}
        >
          <div
            className="paint-chip aspect-[5/4]"
            style={{ ["--chip" as string]: c.hex }}
          />
          <div className="paint-chip-tab px-2 py-1.5 flex items-baseline justify-between gap-2">
            <span className="display-italic text-[12px] text-[var(--color-ink)] truncate">
              {c.name}
            </span>
            <span className="font-mono text-[9px] uppercase text-[var(--color-ink-faint)] tabular-nums shrink-0">
              {c.hex.toUpperCase()}
            </span>
          </div>
          <div className="caption mt-1 ml-0.5 tabular-nums text-[9px]">
            {String(i + 1).padStart(2, "0")} / {String(palette.length).padStart(2, "0")}
          </div>
        </article>
      ))}
    </div>
  );
}
