import Link from "next/link";
import { VibeInput } from "@/components/VibeInput";
import { Polaroid } from "@/components/Polaroid";
import { MobileActionBar } from "@/components/MobileActionBar";
import { ScrollReveal } from "@/components/ScrollReveal";

const HERO = [
  {
    src: "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=900&q=70",
    alt: "warm tokyo cafe interior",
    caption: "a tokyo cafe.",
    num: "fld. 001",
    rotate: "-4deg",
    width: 260,
  },
  {
    src: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=70",
    alt: "candlelit lisbon jazz bar",
    caption: "a lisbon jazz bar.",
    num: "fld. 002",
    rotate: "5deg",
    width: 240,
  },
  {
    src: "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=70",
    alt: "bright hawker centre at night",
    caption: "a hawker, past midnight.",
    num: "fld. 003",
    rotate: "-2deg",
    width: 260,
  },
];

export default function Home() {
  return (
    <>
      {/* Fixed bottom bar — mobile only */}
      <MobileActionBar />

      <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-mobile-bar">

        <Header />

        {/* ── HERO ── */}
        <section className="grid grid-cols-12 gap-8 lg:gap-14 mt-8 md:mt-10 lg:mt-14 items-start">
          {/* Left: type column */}
          <div className="col-span-12 lg:col-span-7 relative">
            <p className="eyebrow underline-draw reveal reveal-1">a field guide, edition 01</p>

            <h1 className="display-xl mt-4 md:mt-5 text-[15vw] md:text-[10vw] lg:text-[136px]">
              <span className="hero-line hero-line-1">
                <span className="hero-word">the feeling</span>
              </span>
              <span className="hero-line hero-line-2">
                <span className="hero-word display-italic">of places,</span>
              </span>
              <span className="hero-line hero-line-3">
                <span className="hero-word">sensed<span className="hero-period">.</span></span>
              </span>
            </h1>

            <p
              className="display-md mt-7 md:mt-10 max-w-[28ch] text-[var(--color-ink-soft)] reveal-body text-[19px] md:text-[24px] leading-[1.45]"
              style={{ animationDelay: "560ms" }}
            >
              Record 15 seconds of a space you love. Viber reads its colors, sounds, and music. Viber finds nearby cafés that with the same vibes.
            </p>

            {/* Pencil annotation — desktop only */}
            <div className="hidden lg:block absolute top-[12rem] right-[-2rem] reveal reveal-5">
              <span className="block sway">
                <PencilArrow />
              </span>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-pencil)] mt-2 ml-3 max-w-[16ch]">
                shazam, but for vibes
              </p>
            </div>
          </div>

          {/* Right: polaroid stack */}
          <div className="col-span-12 lg:col-span-5">
            <div className="relative h-[380px] md:h-[520px] reveal reveal-4">
              <div className="absolute" style={{ top: 0, left: "0%" }}>
                <Polaroid {...HERO[0]} priority tape="tlr" float="a" />
              </div>
              <div className="absolute" style={{ top: "52px", left: "30%" }}>
                <Polaroid {...HERO[1]} tape="top" float="b" />
              </div>
              <div className="absolute" style={{ top: "160px", left: "10%" }}>
                <Polaroid {...HERO[2]} tape="tl" float="c" />
              </div>
            </div>
          </div>
        </section>

        {/* ── Mobile "how it works" strip — mobile only ── */}
        <ScrollReveal as="section" className="mt-10 md:hidden">
          <MobileHowItWorks />
        </ScrollReveal>

        {/* ── Desktop: VibeInput + FieldNote ── */}
        <section className="hidden md:grid mt-36 grid-cols-12 gap-10 lg:gap-16">
          <ScrollReveal className="col-span-12 md:col-span-6">
            <VibeInput />
          </ScrollReveal>
          <ScrollReveal as="aside" className="col-span-12 md:col-span-6 lg:col-span-6 lg:col-start-7" rootMargin="0px">
            <FieldNote />
          </ScrollReveal>
        </section>

        <Footer />
      </main>
    </>
  );
}

function Header() {
  return (
    <div className="pt-6">
      <div className="border-t-2 border-[var(--color-ink)] flex items-center justify-between pt-2 pb-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
          field guide
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
          edition 001 · singapore
        </span>
      </div>
      <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-4 md:pb-5">
        <Link href="/" className="display-italic text-[30px] md:text-[32px] tracking-tight">
          viber<span className="text-[var(--color-stamp)]">.</span>
        </Link>
        <div className="flex items-baseline gap-4 md:gap-5 caption">
          <Link href="/wizard" className="link-underline hidden sm:inline">field lab</Link>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">edition no. 001</span>
          <span className="hidden sm:inline">·</span>
          <span>singapore</span>
          <span>·</span>
          <span className="tabular-nums">may 26</span>
        </div>
      </header>
    </div>
  );
}

/* Compact steps strip — mobile only */
function MobileHowItWorks() {
  return (
    <div className="border-t border-dotted border-[var(--color-rule-soft)] pt-7">
      <p className="caption mb-5">field method</p>
      <ScrollReveal stagger className="flex gap-6 overflow-x-auto pb-1">
        {[
          { num: "i.", title: "sense", body: "Point your camera at any room. 15 seconds." },
          { num: "ii.", title: "locate", body: "We find the cafes near you that match." },
          { num: "iii.", title: "recreate", body: "A 90-second ambient session, yours." },
        ].map((s) => (
          <div key={s.num} className="shrink-0 w-[180px]">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)]">
              {s.num}
            </span>
            <p className="display-italic text-[20px] mt-1 mb-1">{s.title}</p>
            <p className="text-[14px] leading-[1.6] text-[var(--color-ink-soft)]">{s.body}</p>
          </div>
        ))}
      </ScrollReveal>
    </div>
  );
}

function PencilArrow() {
  return (
    <svg width="180" height="80" viewBox="0 0 180 80" fill="none" aria-hidden>
      <path
        d="M 6 14 C 30 6, 60 6, 86 18 S 150 44, 168 64"
        stroke="var(--color-pencil)"
        strokeWidth="1.4"
        strokeLinecap="round"
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
      className="relative bg-[var(--color-paper-hi)] p-8 md:p-10 lg:p-12 paper-fold"
      style={{
        boxShadow:
          "0 2px 0 rgba(28,24,20,0.06), 0 16px 48px rgba(28,24,20,0.20), 0 2px 8px rgba(28,24,20,0.08)",
        transform: "rotate(0.7deg)",
      }}
    >
      {/* Two tape strips */}
      <span
        className="tape"
        style={{ top: -14, left: 28, width: 110, height: 26, transform: "rotate(-4deg)" }}
        aria-hidden
      />
      <span
        className="tape"
        style={{ top: -12, right: 36, width: 80, height: 22, transform: "rotate(3.5deg)" }}
        aria-hidden
      />

      {/* Header */}
      <div className="flex items-center gap-4 mb-8 pb-5 border-b-2 border-[var(--color-ink)]">
        <p className="caption tracking-[0.22em]">field method</p>
        <span className="flex-1 border-t border-dotted border-[var(--color-rule-soft)]" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
          ed. 001
        </span>
      </div>

      <ScrollReveal as="ol" stagger rootMargin="0px">
        <Step num="i."   title="sense"    body="A short clip is sampled into eight stills. We read palette, lighting, density, soundscape, music." />
        <Step num="ii."  title="locate"   body="Cafes near you are scored against the same vector. Top three by feeling, not by stars." />
        <Step num="iii." title="recreate" body="Veo for the picture. Lyria for the music. A short ambient session, ready to fall asleep to." />
      </ScrollReveal>

      {/* Signature */}
      <div className="mt-8 pt-6 border-t border-dotted border-[var(--color-rule-soft)] flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
          signed
        </span>
        <span className="display-italic normal-case tracking-tight text-[22px] text-[var(--color-ink-soft)]">
          the editors of viber
        </span>
      </div>
    </div>
  );
}

function Step({ num, title, body }: { num: string; title: string; body: string }) {
  return (
    <li className="flex gap-6 py-7 border-t border-dotted border-[var(--color-rule-soft)] first:border-t-0 first:pt-0">
      {/* Large editorial numeral */}
      <span
        className="display-italic leading-none shrink-0 select-none"
        style={{
          fontSize: 56,
          color: "var(--color-stamp)",
          opacity: 0.28,
          width: 44,
          textAlign: "right",
          letterSpacing: "-0.02em",
        }}
      >
        {num}
      </span>
      <div className="pt-0.5">
        <p className="display-italic text-[30px] text-[var(--color-ink)] mb-2.5 leading-none">{title}</p>
        <p className="text-[15px] leading-[1.78] text-[var(--color-ink-soft)]">{body}</p>
      </div>
    </li>
  );
}

function Footer() {
  return (
    <footer className="mt-20 md:mt-32 pt-6 border-t border-[var(--color-rule-soft)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 caption mb-4">
        <span>
          a field experiment
          <span className="ml-3 text-[var(--color-ink-faint)]">·</span>
          <span className="ml-3">aie singapore 2026</span>
        </span>
        <span className="display-italic normal-case tracking-normal text-[14px] text-[var(--color-ink-soft)]">
          made for places that already exist.
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 pt-4 border-t border-dotted border-[var(--color-rule-soft)]">
        <span className="text-[var(--color-ink-faint)]" style={{ fontSize: 8 }}>◆</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-[var(--color-ink-faint)]">viber</span>
        <span className="text-[var(--color-ink-faint)]" style={{ fontSize: 8 }}>◆</span>
      </div>
    </footer>
  );
}
