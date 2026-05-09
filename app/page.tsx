import Link from "next/link";
import { VibeInput } from "@/components/VibeInput";
import { Polaroid } from "@/components/Polaroid";

const HERO = [
  {
    src: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=900&q=70",
    alt: "warm tokyo cafe interior",
    caption: "a tokyo cafe.",
    num: "fld. 001",
    rotate: "-4deg",
    width: 320,
  },
  {
    src: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=70",
    alt: "candlelit lisbon jazz bar",
    caption: "a lisbon jazz bar.",
    num: "fld. 002",
    rotate: "5deg",
    width: 300,
  },
  {
    src: "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=70",
    alt: "bright hawker centre at night",
    caption: "a hawker, past midnight.",
    num: "fld. 003",
    rotate: "-2deg",
    width: 320,
  },
];

export default function Home() {
  return (
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-20">
      <Header />

      <section className="grid grid-cols-12 gap-8 lg:gap-14 mt-10 lg:mt-14 items-start">
        {/* Left: type column */}
        <div className="col-span-12 lg:col-span-7 relative">
          <p className="eyebrow reveal reveal-1">a field guide, edition 01</p>

          <h1 className="display-xl mt-5 reveal reveal-2 text-[14vw] md:text-[10vw] lg:text-[136px]">
            the feeling
            <br />
            <span className="display-italic">of places,</span>
            <br />
            sensed.
          </h1>

          <p className="display-md mt-10 max-w-[28ch] text-[var(--color-ink-soft)] reveal reveal-3 text-[22px] md:text-[24px]">
            Record fifteen seconds of any room you love. Viber reads the
            palette, the soundscape, the music underneath. Then we go and find
            the cafes near you that feel the same.
          </p>

          {/* Pencil-arrow annotation */}
          <div className="hidden lg:block absolute top-[12rem] right-[-2rem] reveal reveal-5">
            <PencilArrow />
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-pencil)] mt-2 ml-3 max-w-[16ch]">
              shazam, but for vibes
            </p>
          </div>
        </div>

        {/* Right: polaroid stack */}
        <div className="col-span-12 lg:col-span-5">
          <div className="relative h-[440px] md:h-[520px] reveal reveal-4">
            <div
              className="absolute"
              style={{ top: 0, left: "0%" }}
            >
              <Polaroid
                {...HERO[0]}
                priority
                tape="tlr"
              />
            </div>
            <div
              className="absolute"
              style={{ top: "60px", left: "32%" }}
            >
              <Polaroid {...HERO[1]} tape="top" />
            </div>
            <div
              className="absolute"
              style={{ top: "180px", left: "12%" }}
            >
              <Polaroid {...HERO[2]} tape="tl" />
            </div>
          </div>
        </div>
      </section>

      <section className="mt-24 md:mt-36 grid grid-cols-12 gap-10 lg:gap-16">
        <div className="col-span-12 md:col-span-6 reveal reveal-6">
          <VibeInput />
        </div>

        <aside className="col-span-12 md:col-span-6 lg:col-span-5 lg:col-start-8 reveal reveal-7">
          <FieldNote />
        </aside>
      </section>

      <Footer />
    </main>
  );
}

function Header() {
  return (
    <header className="pt-10 flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
      <Link href="/" className="display-italic text-[32px] tracking-tight">
        viber<span className="text-[var(--color-stamp)]">.</span>
      </Link>
      <div className="flex items-baseline gap-5 caption">
        <Link href="/wizard" className="link-underline">field lab</Link>
        <span>·</span>
        <span className="hidden sm:inline">edition no. 001</span>
        <span className="hidden sm:inline">·</span>
        <span>singapore</span>
        <span>·</span>
        <span className="tabular-nums">may 26</span>
      </div>
    </header>
  );
}

function PencilArrow() {
  return (
    <svg
      width="180"
      height="80"
      viewBox="0 0 180 80"
      fill="none"
      aria-hidden
    >
      <path
        d="M 6 14 C 30 6, 60 6, 86 18 S 150 44, 168 64"
        stroke="var(--color-pencil)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray="0 0"
        opacity="0.8"
      />
      <path
        d="M 158 60 L 168 64 L 162 72"
        stroke="var(--color-pencil)"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
        opacity="0.8"
      />
    </svg>
  );
}

function FieldNote() {
  return (
    <div
      className="relative bg-[var(--color-paper-hi)] p-6 md:p-8"
      style={{
        boxShadow:
          "0 1px 0 rgba(28,24,20,0.04), 0 8px 24px rgba(28,24,20,0.12)",
        transform: "rotate(0.6deg)",
      }}
    >
      <span
        className="tape"
        style={{
          top: -10,
          left: 24,
          width: 96,
          height: 22,
          transform: "rotate(-3deg)",
        }}
        aria-hidden
      />
      <p className="caption mb-5">field method</p>
      <ol className="space-y-5">
        <Step
          num="i."
          title="sense"
          body="A short clip is sampled into eight stills. We read palette, lighting, density, soundscape, music."
        />
        <Step
          num="ii."
          title="locate"
          body="Cafes near you are scored against the same vector. Top three by feeling, not by stars."
        />
        <Step
          num="iii."
          title="recreate"
          body="Veo for the picture. Lyria for the music. A short ambient session, ready to fall asleep to."
        />
      </ol>
      <div className="mt-7 flex items-baseline justify-between caption">
        <span>signed</span>
        <span className="display-italic normal-case tracking-tight text-[16px] text-[var(--color-ink-soft)]">
          the editors of viber
        </span>
      </div>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <li className="flex items-baseline gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)] tabular-nums">
        {num}
      </span>
      <div>
        <span className="display-italic text-[22px] text-[var(--color-ink)] mr-3">
          {title}
        </span>
        <span className="text-[16px] leading-[1.6] text-[var(--color-ink-soft)]">
          {body}
        </span>
      </div>
    </li>
  );
}

function Footer() {
  return (
    <footer className="mt-32 pt-6 border-t border-[var(--color-rule-soft)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 caption">
        <span>
          a field experiment
          <span className="ml-3 text-[var(--color-ink-faint)]">·</span>
          <span className="ml-3">aie singapore 2026</span>
        </span>
        <span className="display-italic normal-case tracking-normal text-[14px] text-[var(--color-ink-soft)]">
          made for places that already exist.
        </span>
      </div>
    </footer>
  );
}
