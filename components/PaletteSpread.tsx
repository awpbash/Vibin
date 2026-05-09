import type { VibeObject } from "@/lib/types";

export function PaletteSpread({ palette }: { palette: VibeObject["palette"] }) {
  return (
    <div className="grid grid-cols-12 gap-4 lg:gap-6 items-end">
      {palette.map((c, i) => (
        <div
          key={c.hex}
          className="col-span-6 sm:col-span-3"
          style={{ animationDelay: `${i * 80 + 200}ms` }}
        >
          <div
            className="aspect-[4/5] mb-3 reveal"
            style={{
              backgroundColor: c.hex,
              boxShadow: "inset 0 0 0 1px rgba(26,29,26,0.08)",
              animationDelay: `${i * 80 + 200}ms`,
            }}
          />
          <div className="flex items-baseline justify-between gap-3 reveal" style={{ animationDelay: `${i * 80 + 280}ms` }}>
            <span className="display-italic text-[15px] text-[var(--color-ink)]">
              {c.name}
            </span>
            <span className="font-mono text-[10px] uppercase text-[var(--color-ink-faint)] tabular-nums">
              {c.hex}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
