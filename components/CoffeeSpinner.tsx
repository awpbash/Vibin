"use client";

// A pouring + brewing coffee animation used wherever the pipeline is
// thinking. Replaces a generic three-dot spinner during upload, vibe
// extraction, and music/video generation. All colors come from the
// editorial palette (paper, ink, stamp), so the spinner re-tints with
// the active vibe palette via CSS vars.

type Size = "xs" | "sm" | "md" | "lg";

const SIZES: Record<
  Size,
  { wrap: string; cup: string; handle: string; liquid: string }
> = {
  xs: { wrap: "w-9 h-12", cup: "w-7 h-6", handle: "w-1.5 h-3", liquid: "h-3" },
  sm: { wrap: "w-16 h-20", cup: "w-12 h-10", handle: "w-3 h-5", liquid: "h-6" },
  md: { wrap: "w-24 h-32", cup: "w-16 h-14", handle: "w-4 h-7", liquid: "h-8" },
  lg: { wrap: "w-32 h-44", cup: "w-20 h-18", handle: "w-5 h-9", liquid: "h-10" },
};

const POUR_PX: Record<Size, { tall: number; short: number }> = {
  xs: { tall: 9, short: 6 },
  sm: { tall: 16, short: 12 },
  md: { tall: 22, short: 16 },
  lg: { tall: 28, short: 20 },
};

export function CoffeeSpinner({
  size = "sm",
  caption,
  className = "",
}: {
  size?: Size;
  caption?: string;
  className?: string;
}) {
  const s = SIZES[size];
  const pour = POUR_PX[size];

  return (
    <span
      className={`inline-flex flex-col items-center gap-2 ${className}`}
      role="status"
      aria-label={caption ?? "loading"}
    >
      <span className={`relative block ${s.wrap}`}>
        {/* Pour stream — three drop-shaped bars over the cup */}
        <span className="absolute top-0 left-1/2 -translate-x-1/2 flex items-end gap-0.5">
          <span
            className="block w-1 rounded-full coffee-pour-1"
            style={{
              height: pour.short,
              background: "var(--color-ink)",
            }}
          />
          <span
            className="block w-1.5 rounded-full coffee-pour-2"
            style={{
              height: pour.tall,
              background: "var(--color-stamp)",
            }}
          />
          <span
            className="block w-1 rounded-full coffee-pour-3"
            style={{
              height: pour.short,
              background: "var(--color-ink)",
            }}
          />
        </span>

        {/* Cup */}
        <span
          className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${s.cup}`}
        >
          <span className="relative block w-full h-full">
            {/* Cup body */}
            <span
              className="absolute inset-0 overflow-hidden"
              style={{
                background: "var(--color-paper-hi)",
                border: "2px solid var(--color-stamp)",
                borderTop: "none",
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
              }}
            >
              {/* Coffee liquid — fills/empties */}
              <span
                className={`absolute bottom-0 left-0 right-0 coffee-fill ${s.liquid}`}
                style={{
                  background: "var(--color-ink)",
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                }}
              >
                {/* Surface shimmer */}
                <span
                  className="absolute top-0 left-0 right-0 h-[2px] coffee-shimmer"
                  style={{ background: "var(--color-stamp)", opacity: 0.5 }}
                />
              </span>
            </span>

            {/* Handle */}
            <span
              className={`absolute top-1/2 -translate-y-1/2 ${s.handle}`}
              style={{
                right: -10,
                border: "2px solid var(--color-stamp)",
                borderLeft: "none",
                borderTopRightRadius: 999,
                borderBottomRightRadius: 999,
                background: "var(--color-paper-hi)",
              }}
            />

            {/* Steam */}
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-end gap-1">
              <span
                className="block w-[2px] h-3 rounded-full coffee-steam-1"
                style={{ background: "var(--color-ink-mute)" }}
              />
              <span
                className="block w-[2px] h-4 rounded-full coffee-steam-2"
                style={{ background: "var(--color-ink-mute)" }}
              />
              <span
                className="block w-[2px] h-3 rounded-full coffee-steam-3"
                style={{ background: "var(--color-ink-mute)" }}
              />
            </span>
          </span>
        </span>
      </span>

      {caption ? (
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-mute)]">
          {caption}
        </span>
      ) : null}
    </span>
  );
}
