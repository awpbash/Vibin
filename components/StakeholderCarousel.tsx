"use client";

const DISPATCHES = [
  {
    num: "01",
    role: "small business owner",
    name: "mei lin, founder",
    quote:
      "I was opening a café in Tiong Bahru and wanted the vibe of a Kyoto kissaten I'd loved for years. Viber found me two local spots with that exact feeling — they became my entire design brief.",
    useCase: "café concept research",
    rotate: "-0.6deg",
  },
  {
    num: "02",
    role: "university student",
    name: "arjun, nus architecture",
    quote:
      "I needed a study spot that felt focused but not sterile. Viber matched my 15-second library clip to a place in Holland Village I'd walked past a hundred times and never entered.",
    useCase: "productive space finding",
    rotate: "0.5deg",
  },
  {
    num: "03",
    role: "event planner",
    name: "sofia, independent",
    quote:
      "My client said 'Tokyo industrial, but warm.' I recorded a reference space and Viber gave me three venues in twenty seconds. The client approved the first one.",
    useCase: "venue scouting",
    rotate: "-0.4deg",
  },
  {
    num: "04",
    role: "interior designer",
    name: "kai, studio practice",
    quote:
      "Viber articulates what I sense intuitively — palette, soundscape, density — in a format I can actually present to clients. It replaced two pages of mood board notes.",
    useCase: "client presentation",
    rotate: "0.6deg",
  },
  {
    num: "05",
    role: "new to singapore",
    name: "yuna, relocated from seoul",
    quote:
      "I was homesick for my neighborhood coffee shop in Seoul. I recorded 15 seconds on my phone and Viber matched the feeling within three blocks. It became my place within the week.",
    useCase: "neighbourhood discovery",
    rotate: "-0.3deg",
  },
];

const TAPE_ANGLES = [-4, 3, -3.5, 4, -2.5];

// Cards rendered twice for seamless infinite loop.
// Each card has margin-right: CARD_GAP (not flex gap) so the
// total inner-track width is exactly 2 × (5 × CARD_W + 5 × CARD_GAP),
// making translateX(-50%) land on card-6 start = card-1 start. ✓
const CARD_W = 370;
const CARD_GAP = 28;

const ALL = [...DISPATCHES, ...DISPATCHES];

export function StakeholderCarousel() {
  return (
    <div>
      <div className="carousel-outer">
        <div className="carousel-marquee-track">
          {ALL.map((d, i) => {
            const base = i % DISPATCHES.length;
            return (
              <article
                key={`${d.num}-${i}`}
                className="relative bg-[var(--color-paper-hi)] paper-fold flex flex-col"
                style={{
                  width: CARD_W,
                  minHeight: 320,
                  marginRight: CARD_GAP,
                  flexShrink: 0,
                  padding: "2rem 1.75rem 1.75rem",
                  boxShadow: "var(--shadow-paper)",
                  transform: `rotate(${d.rotate})`,
                }}
              >
                {/* Tape */}
                <span
                  className="tape"
                  style={{
                    top: -10,
                    left: 20,
                    width: 80,
                    height: 20,
                    transform: `rotate(${TAPE_ANGLES[base]}deg)`,
                  }}
                  aria-hidden
                />

                {/* Card number */}
                <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-faint)] self-end mb-4">
                  {d.num}
                </span>

                {/* Use-case tag */}
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-stamp)] mb-3">
                  {d.useCase}
                </span>

                {/* Quote */}
                <blockquote className="display-italic text-[19px] leading-[1.58] text-[var(--color-ink)] flex-1 mb-6">
                  &ldquo;{d.quote}&rdquo;
                </blockquote>

                {/* Attribution */}
                <div className="border-t border-dotted border-[var(--color-rule-soft)] pt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)]">
                    {d.name}
                  </p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)] mt-0.5">
                    {d.role}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] opacity-60 text-center">
        hover to pause · field dispatches
      </p>
    </div>
  );
}
