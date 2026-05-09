import Link from "next/link";
import { notFound } from "next/navigation";
import { getVibe, getPlacesForVibe } from "@/lib/mock-data";
import { ApplyPalette } from "@/components/ApplyPalette";
import { Polaroid } from "@/components/Polaroid";
import { PaintChips } from "@/components/PaintChips";
import { NearbyMap } from "@/components/NearbyMap";
import { PlaceCard } from "@/components/PlaceCard";
import type { VibeObject } from "@/lib/types";

export default async function VibePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vibe = await getVibe(id);
  if (!vibe) return notFound();
  const places = await getPlacesForVibe(id);

  const issue = hashIssue(id);
  const date = formatDate(vibe.createdAt);
  const paletteHexes = vibe.palette.map((c) => c.hex);
  const cover = coverImageFor(vibe, places[0]?.photoUrl);

  return (
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-24 md:pb-20">
      <ApplyPalette hexes={paletteHexes} accent={vibe.palette[1]?.hex} />
      <Header issue={issue} date={date} />

      {/* ───── HERO ───── */}
      <section className="grid grid-cols-12 gap-8 lg:gap-14 mt-10 lg:mt-14 items-start">
        <div className="col-span-12 lg:col-span-7">
          <p className="eyebrow reveal reveal-1">
            from {vibe.source.title ?? vibe.source.url ?? "a clip"}
          </p>

          <h1 className="display-xl reveal reveal-2 mt-5 text-[12vw] md:text-[8vw] lg:text-[112px]">
            {splitTitle(vibe.title)}
          </h1>

          <p className="display-italic reveal reveal-3 mt-8 text-[22px] md:text-[26px] leading-[1.4] text-[var(--color-ink-soft)] max-w-[44ch]">
            {vibe.oneLiner}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 reveal reveal-4">
            <MeterField label="density" value={vibe.density} />
            <span className="caption text-[var(--color-ink-faint)]">·</span>
            <MeterField label="energy" value={vibe.energy} />
            <span className="caption text-[var(--color-ink-faint)]">·</span>
            <span className="caption">{vibe.timeOfDay.replace(/-/g, " ")}</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 reveal reveal-5">
          {/* On mobile: full bleed, no fixed width. On desktop: right-aligned fixed. */}
          <div className="md:ml-auto" style={{ maxWidth: "100%" }}>
            <Polaroid
              src={cover}
              alt={vibe.title}
              caption={`fld. ${String(issue).padStart(3, "0")}`}
              num={date}
              rotate="3deg"
              tape="tlr"
              width={360}
              height={400}
              priority
            />
          </div>
        </div>
      </section>

      {/* ───── PALETTE ───── */}
      <section className="mt-24 md:mt-36">
        <SectionHead num="01" label="palette" />
        <PaintChips palette={vibe.palette} />
      </section>

      {/* ───── A SENSE OF PLACE ───── */}
      <section className="mt-24 md:mt-32">
        <SectionHead num="02" label="a sense of place" />
        <div className="grid grid-cols-12 gap-y-10 gap-x-10">
          <Field
            label="lighting"
            body={vibe.lighting}
            className="col-span-12 md:col-span-4"
          />
          <Field
            label="spatial"
            body={vibe.spatial}
            className="col-span-12 md:col-span-4"
          />
          <Field
            label="time"
            body={`${vibe.timeOfDay.replace(/-/g, " ")} / ${
              vibe.weatherImplied ?? "indoor weather"
            }`}
            className="col-span-12 md:col-span-4"
          />
        </div>
      </section>

      {/* ───── SOUNDSCAPE / MOOD / MUSIC ───── */}
      <section className="mt-16 md:mt-32 grid grid-cols-12 gap-x-10 gap-y-10 md:gap-y-12">
        <div className="col-span-12 md:col-span-5">
          <SectionHead num="03" label="soundscape" />
          <ol className="space-y-4">
            {vibe.soundscape.map((s, i) => (
              <li
                key={s}
                className="flex items-baseline gap-4 reveal border-b border-dotted border-[var(--color-rule-soft)] pb-4"
                style={{ animationDelay: `${i * 80 + 200}ms` }}
              >
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink-faint)] shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="display-md text-[22px] md:text-[22px] text-[var(--color-ink)]">
                  {s}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="col-span-12 md:col-span-3">
          <SectionHead num="04" label="mood" />
          <ul className="flex flex-wrap gap-2">
            {vibe.moodTags.map((m, i) => (
              <li
                key={m}
                className="reveal"
                style={{
                  animationDelay: `${i * 80 + 280}ms`,
                  background: "var(--color-paper-hi)",
                  padding: "6px 14px",
                  boxShadow: "var(--shadow-card)",
                  border: "1px solid rgba(28,24,20,0.07)",
                  transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (0.5 + i * 0.18)}deg)`,
                }}
              >
                <span className="display-italic text-[18px] text-[var(--color-ink)]">
                  {m}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="col-span-12 md:col-span-4">
          <SectionHead num="05" label="music" />
          <dl className="space-y-3">
            <Row k="genre" v={vibe.musicAnchor.genre} />
            <Row k="tempo" v={`${vibe.musicAnchor.tempoBpm} bpm`} mono />
            {vibe.musicAnchor.key ? <Row k="key" v={vibe.musicAnchor.key} mono /> : null}
            {vibe.musicAnchor.referenceTrack ? (
              <Row k="ref." v={vibe.musicAnchor.referenceTrack} italic />
            ) : null}
          </dl>
        </div>
      </section>

      {/* ───── NEARBY ───── */}
      <section className="mt-20 md:mt-40">
        <div className="flex items-baseline justify-between mb-6 md:mb-8">
          <SectionHead num="06" label="nearby" inline />
          <span className="caption hidden sm:inline">ranked by feeling, not stars</span>
        </div>

        <div className="grid grid-cols-12 gap-x-10 gap-y-8 md:gap-y-10">
          <div className="col-span-12 lg:col-span-7">
            <NearbyMap places={places} />
          </div>
          <div className="col-span-12 lg:col-span-5 space-y-7">
            {places.map((p, i) => (
              <PlaceCard key={p.id} place={p} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ───── PLAY ───── */}
      <section className="mt-24 md:mt-44">
        <div className="border-t border-[var(--color-rule)] pt-8 md:pt-10" />
        <div className="grid grid-cols-12 gap-10 items-center md:items-end">
          <div className="col-span-12 md:col-span-7">
            <SectionHead num="07" label="for the night you cant go" />
            <h2 className="display-lg text-[38px] md:text-[68px] max-w-[18ch]">
              Play it back, anywhere.
            </h2>
            <p className="mt-4 text-[15px] md:text-[16px] leading-[1.55] text-[var(--color-ink-soft)] max-w-[46ch]">
              A ninety-second preview rendered from the same palette, the same
              music, the same room.
            </p>
          </div>

          <div className="col-span-12 md:col-span-5 flex justify-center md:justify-end">
            <Link
              href={`/v/${vibe.id}/play`}
              className="inline-flex"
              aria-label="play this vibe"
            >
              <PlayStamp />
            </Link>
          </div>
        </div>
      </section>

      <Footer issue={issue} date={date} />
    </main>
  );
}

// ---------- pieces ----------

function MeterField({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="caption">{label}</span>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink)]">
        {Math.round(value * 100)}
      </span>
    </div>
  );
}

function Header({ issue, date }: { issue: number; date: string }) {
  return (
    <div className="pt-6">
      <div className="border-t-2 border-[var(--color-ink)] flex items-center justify-between pt-2 pb-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
          field guide
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
          v.{String(issue).padStart(3, "0")} · {date}
        </span>
      </div>
      <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
        <Link href="/" className="display-italic text-[32px] tracking-tight">
          viber<span className="text-[var(--color-stamp)]">.</span>
        </Link>
        <div className="flex items-baseline gap-5 caption">
          <Link href="/" className="hover:text-[var(--color-stamp)] transition-colors">
            ← back
          </Link>
          <span>·</span>
          <Link href="/wizard" className="link-underline">field lab</Link>
        </div>
      </header>
    </div>
  );
}

function Footer({ issue, date }: { issue: number; date: string }) {
  return (
    <footer className="mt-32 pt-6 border-t border-[var(--color-rule-soft)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 caption mb-4">
        <span>
          edition {String(issue).padStart(3, "0")}
          <span className="ml-3 text-[var(--color-ink-faint)]">·</span>
          <span className="ml-3 tabular-nums">{date}</span>
        </span>
        <span className="display-italic normal-case tracking-normal text-[14px] text-[var(--color-ink-soft)]">
          sensed by viber, recreated by gpt-5.5, gemini, veo, and lyria.
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

function SectionHead({
  num,
  label,
  inline = false,
}: {
  num: string;
  label: string;
  inline?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-3 ${inline ? "" : "mb-7"}`}>
      <span className="font-mono text-[10px] tabular-nums tracking-[0.22em] text-[var(--color-ink-faint)]">
        {num}.
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-mute)]">
        {label}
      </span>
      <span className="flex-1 ml-3 border-t border-dotted border-[var(--color-rule-soft)]" />
    </div>
  );
}

function Field({
  label,
  body,
  className = "",
}: {
  label: string;
  body: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className="caption block mb-3">{label}</span>
      <p className="display-md text-[22px] leading-[1.35] text-[var(--color-ink)] max-w-[28ch]">
        {body}
      </p>
    </div>
  );
}

function Row({
  k,
  v,
  italic,
  mono,
}: {
  k: string;
  v: string;
  italic?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="grid grid-cols-12 items-baseline gap-3 border-t border-dotted border-[var(--color-rule-soft)] pt-3">
      <dt className="col-span-3 caption">{k}</dt>
      <dd
        className={`col-span-9 text-[16px] text-[var(--color-ink)] ${
          italic ? "display-italic text-[18px]" : ""
        } ${mono ? "font-mono tabular-nums text-[14px]" : ""}`}
      >
        {v}
      </dd>
    </div>
  );
}

function PlayStamp() {
  return (
    <span
      className="stamp stamp-rotate"
      style={{
        color: "var(--color-stamp-ink)",
        cursor: "pointer",
        /* Scale down gracefully on very small screens */
        transform: "rotate(-7deg) scale(min(1, calc(100vw / 320px)))",
      }}
    >
      <span className="stamp-ink" aria-hidden />
      <svg
        width="264"
        height="264"
        viewBox="0 0 264 264"
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <defs>
          <path id="stamp-arc-top-2" d="M 32,132 A 100,100 0 0,1 232,132" />
          <path id="stamp-arc-bot-2" d="M 32,132 A 100,100 0 0,0 232,132" />
        </defs>
        <text
          fill="currentColor"
          fontFamily="var(--font-mono)"
          fontSize="11"
          letterSpacing="3"
          opacity="0.85"
        >
          <textPath href="#stamp-arc-top-2" startOffset="50%" textAnchor="middle">
            VIBER · PRESS TO PLAY · 0:90
          </textPath>
        </text>
        <text
          fill="currentColor"
          fontFamily="var(--font-mono)"
          fontSize="10"
          letterSpacing="2.5"
          opacity="0.7"
        >
          <textPath href="#stamp-arc-bot-2" startOffset="50%" textAnchor="middle">
            FIELD UNIT · ED. 001
          </textPath>
        </text>
      </svg>
      <span className="relative flex flex-col items-center gap-1.5">
        <span
          className="display-italic leading-none"
          style={{ fontSize: 56, color: "currentColor" }}
        >
          play
        </span>
        <span
          className="font-mono text-[10px] tracking-[0.22em] uppercase"
          style={{ color: "currentColor", opacity: 0.85 }}
        >
          this vibe
        </span>
      </span>
    </span>
  );
}

// ---------- helpers ----------

function splitTitle(t: string) {
  const parts = t.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const head = parts[0] + ",";
    const tail = parts.slice(1).join(", ");
    return (
      <>
        {head}
        <br />
        <span className="display-italic">{tail}.</span>
      </>
    );
  }
  return t;
}

function hashIssue(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  return Math.abs(h % 999) + 1;
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}.${day}.${String(d.getFullYear()).slice(-2)}`;
}

// Curated covers for the three fixture vibes — more reliable than YouTube thumbnails.
const FIXTURE_COVERS: Record<string, string> = {
  "tokyo-coffee":
    "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=900&q=80",
  "lisbon-jazz":
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80",
  "midnight-hawker":
    "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=900&q=80",
};

function coverImageFor(vibe: VibeObject, fallback?: string): string {
  // Fixture vibes (exact ID or upload-derived copy): use curated Unsplash images.
  const fixtureKey = Object.keys(FIXTURE_COVERS).find((k) => vibe.id.startsWith(k));
  if (fixtureKey) return FIXTURE_COVERS[fixtureKey];

  // Real YouTube vibes: sddefault (640×480) is far more reliably served than hqdefault.
  if (vibe.source.kind === "youtube" && vibe.source.url) {
    const m = /[?&]v=([^&]+)|youtu\.be\/([^?&]+)/.exec(vibe.source.url);
    const vid = m?.[1] ?? m?.[2];
    if (vid) return `https://i.ytimg.com/vi/${vid}/sddefault.jpg`;
  }

  return (
    fallback ??
    "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=900&q=80"
  );
}
