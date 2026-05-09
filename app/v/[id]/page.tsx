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
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-20">
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

          <div className="mt-8 flex flex-wrap items-baseline gap-x-5 gap-y-2 caption reveal reveal-4">
            <span>density</span>
            <span className="tabular-nums text-[var(--color-ink)]">
              {Math.round(vibe.density * 100)}
            </span>
            <span>·</span>
            <span>energy</span>
            <span className="tabular-nums text-[var(--color-ink)]">
              {Math.round(vibe.energy * 100)}
            </span>
            <span>·</span>
            <span>{vibe.timeOfDay.replace(/-/g, " ")}</span>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 reveal reveal-5">
          <div
            className="ml-auto"
            style={{ width: 360, maxWidth: "100%" }}
          >
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
      <section className="mt-24 md:mt-32 grid grid-cols-12 gap-x-10 gap-y-12">
        <div className="col-span-12 md:col-span-5">
          <SectionHead num="03" label="soundscape" />
          <ol className="space-y-3">
            {vibe.soundscape.map((s, i) => (
              <li
                key={s}
                className="flex items-baseline gap-4 reveal"
                style={{ animationDelay: `${i * 80 + 200}ms` }}
              >
                <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink-faint)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="display-md text-[22px] text-[var(--color-ink)]">
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
                  padding: "6px 12px",
                  boxShadow: "var(--shadow-card)",
                  transform: `rotate(${(i % 2 === 0 ? -1 : 1) * (0.6 + i * 0.2)}deg)`,
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
      <section className="mt-28 md:mt-40">
        <div className="flex items-baseline justify-between mb-8">
          <SectionHead num="06" label="nearby" inline />
          <span className="caption">ranked by feeling, not stars</span>
        </div>

        <div className="grid grid-cols-12 gap-x-10 gap-y-10">
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
      <section className="mt-32 md:mt-44">
        <div className="border-t border-[var(--color-rule)] pt-10" />
        <div className="grid grid-cols-12 gap-10 items-end">
          <div className="col-span-12 md:col-span-7">
            <SectionHead num="07" label="for the night you cant go" />
            <h2 className="display-lg text-[44px] md:text-[68px] max-w-[18ch]">
              Play it back, anywhere.
            </h2>
            <p className="mt-4 text-[16px] leading-[1.55] text-[var(--color-ink-soft)] max-w-[46ch]">
              A ninety-second preview rendered from the same palette, the same
              music, the same room. Three hours when you connect a card.
            </p>
          </div>

          <div className="col-span-12 md:col-span-5 flex md:justify-end">
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

function Header({ issue, date }: { issue: number; date: string }) {
  return (
    <header className="pt-10 flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
      <Link href="/" className="display-italic text-[32px] tracking-tight">
        viber<span className="text-[var(--color-stamp)]">.</span>
      </Link>
      <div className="flex items-baseline gap-5 caption">
        <Link href="/" className="hover:text-[var(--color-stamp)] transition-colors">
          back
        </Link>
        <span>·</span>
        <Link href="/wizard" className="link-underline">field lab</Link>
        <span>·</span>
        <span className="tabular-nums">v.{String(issue).padStart(3, "0")}</span>
        <span>·</span>
        <span className="tabular-nums">{date}</span>
      </div>
    </header>
  );
}

function Footer({ issue, date }: { issue: number; date: string }) {
  return (
    <footer className="mt-32 pt-6 border-t border-[var(--color-rule-soft)]">
      <div className="flex flex-wrap items-baseline justify-between gap-3 caption">
        <span>
          edition {String(issue).padStart(3, "0")}
          <span className="ml-3 text-[var(--color-ink-faint)]">·</span>
          <span className="ml-3 tabular-nums">{date}</span>
        </span>
        <span className="display-italic normal-case tracking-normal text-[14px] text-[var(--color-ink-soft)]">
          sensed by viber, recreated by gpt-5.5, gemini, veo, and lyria.
        </span>
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

function coverImageFor(vibe: VibeObject, fallback?: string): string {
  if (vibe.source.kind === "youtube" && vibe.source.url) {
    const m = /[?&]v=([^&]+)|youtu\.be\/([^?&]+)/.exec(vibe.source.url);
    const vid = m?.[1] ?? m?.[2];
    if (vid) return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;
  }
  return (
    fallback ??
    "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=900&q=70"
  );
}
