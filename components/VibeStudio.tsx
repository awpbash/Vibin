"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApplyPalette } from "@/components/ApplyPalette";
import { PaintChips } from "@/components/PaintChips";
import { NearbyMap } from "@/components/NearbyMap";
import { PlaceCard } from "@/components/PlaceCard";
import type { Place, VibeObject } from "@/lib/types";

type Status = "idle" | "running" | "done" | "error";

type VideoProgressState = {
  stage: "idle" | "brief" | "veo" | "stitch" | "done" | "error";
  percent: number;
  message: string | null;
  error?: string | null;
  veoClipsTotal: number;
  veoClipsCompleted: number;
  elapsedMs: number;
};

export function VibeStudio({
  vibe: initial,
  places,
}: {
  vibe: VibeObject;
  places: Place[];
}) {
  const [vibe, setVibe] = useState<VibeObject>(initial);
  const [musicStatus, setMusicStatus] = useState<Status>(
    initial.generatedAssets?.musicUrl ? "done" : "idle",
  );
  const [musicMs, setMusicMs] = useState<number | null>(null);
  const [musicErr, setMusicErr] = useState<string | null>(null);

  const [videoStatus, setVideoStatus] = useState<Status>(
    initial.generatedAssets?.previewVideoUrl ? "done" : "idle",
  );
  const [videoMs, setVideoMs] = useState<number | null>(null);
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoProgressState | null>(null);
  const autoRanRef = useRef(false);

  // Poll the video progress endpoint while a render is in flight so
  // the user gets a real bar instead of "rendering..." for 4 minutes.
  useEffect(() => {
    if (videoStatus !== "running") return;
    let cancelled = false;
    const tick = async () => {
      try {
        const r = await fetch(
          `/api/generate/video/progress?vibeId=${encodeURIComponent(vibe.id)}`,
          { cache: "no-store" },
        );
        if (!r.ok) return;
        const json = (await r.json()) as VideoProgressState;
        if (!cancelled) setVideoProgress(json);
      } catch {
        // ignore — transient
      }
    };
    void tick();
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [videoStatus, vibe.id]);

  async function generateMusic() {
    setMusicStatus("running");
    setMusicErr(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/generate/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibeId: vibe.id }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || res.statusText);
      setMusicMs(Math.round(performance.now() - t0));
      setMusicStatus("done");
      setVibe((v) => ({
        ...v,
        generatedAssets: {
          ...(v.generatedAssets ?? {}),
          musicUrl: json.musicUrl,
          musicPrompt: json.prompt,
          musicDurationMs: json.lengthMs,
        },
      }));
    } catch (e) {
      setMusicStatus("error");
      setMusicErr(e instanceof Error ? e.message : "music failed");
    }
  }

  async function generateVideo() {
    setVideoStatus("running");
    setVideoErr(null);
    const t0 = performance.now();
    try {
      const res = await fetch("/api/generate/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vibeId: vibe.id }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || res.statusText);
      setVideoMs(Math.round(performance.now() - t0));
      setVideoStatus("done");
      setVibe((v) => ({
        ...v,
        generatedAssets: {
          ...(v.generatedAssets ?? {}),
          previewVideoUrl: json.videoUrl,
          videoDurationSeconds: json.durationSeconds,
        },
      }));
    } catch (e) {
      setVideoStatus("error");
      setVideoErr(e instanceof Error ? e.message : "video failed");
    }
  }

  // Auto-run music on first load only — video is too slow to fire silently
  // in the background (3-4 minutes in chain mode would hang the demo).
  // Music is fast enough to stream in while the judge reads. User clicks
  // 'render the picture' explicitly to start the video and watch the bar.
  useEffect(() => {
    if (autoRanRef.current) return;
    autoRanRef.current = true;
    const auto = new URLSearchParams(window.location.search).get("auto");
    if (auto === "0") return;
    if (musicStatus === "idle") void generateMusic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const issue = hashIssue(vibe.id);
  const date = formatDate(vibe.createdAt);
  const paletteHexes = vibe.palette.map((c) => c.hex);

  return (
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-20">
      <ApplyPalette hexes={paletteHexes} accent={vibe.palette[1]?.hex} />
      <Header issue={issue} date={date} />

      {/* ───── 01 Source ───── */}
      <Step n="01" label="your clip">
        <SourceClip vibe={vibe} />
      </Step>

      {/* ───── 02 Vibe read ───── */}
      <Step n="02" label="what we read">
        <VibeRead vibe={vibe} />
      </Step>

      {/* ───── 03 Music ───── */}
      <Step n="03" label="compose the music" status={musicStatus} ms={musicMs}>
        <MusicPanel
          vibe={vibe}
          status={musicStatus}
          err={musicErr}
          onRun={generateMusic}
        />
      </Step>

      {/* ───── 04 Video ───── */}
      <Step n="04" label="render the picture" status={videoStatus} ms={videoMs}>
        <VideoPanel
          vibe={vibe}
          status={videoStatus}
          err={videoErr}
          onRun={generateVideo}
          musicAvailable={Boolean(vibe.generatedAssets?.musicUrl)}
          progress={videoProgress}
        />
      </Step>

      {/* ───── 05 Nearby ───── */}
      <Step n="05" label="nearby">
        <Nearby places={places} />
      </Step>

      <Footer issue={issue} date={date} />
    </main>
  );
}

// ---------- Sections ----------

function Header({ issue, date }: { issue: number; date: string }) {
  return (
    <header className="pt-10 flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
      <Link href="/" className="display-italic text-[32px] tracking-tight">
        viber<span className="text-[var(--color-stamp)]">.</span>
      </Link>
      <div className="flex items-baseline gap-5 caption">
        <Link href="/" className="hover:text-[var(--color-stamp)] transition-colors">back</Link>
        <span>·</span>
        <Link href="/lab" className="link-underline">field lab</Link>
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
          sensed by gpt-5.5, scored by elevenlabs.
        </span>
      </div>
    </footer>
  );
}

function Step({
  n,
  label,
  status,
  ms,
  children,
}: {
  n: string;
  label: string;
  status?: Status;
  ms?: number | null;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-16 md:mt-24">
      <div className="flex items-baseline gap-3 mb-7">
        <span className="font-mono text-[10px] tabular-nums tracking-[0.22em] text-[var(--color-ink-faint)]">
          {n}.
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-mute)]">
          {label}
        </span>
        <span className="flex-1 ml-3 border-t border-dotted border-[var(--color-rule-soft)]" />
        {status ? <StatusPill status={status} ms={ms ?? null} /> : null}
      </div>
      {children}
    </section>
  );
}

function StatusPill({ status, ms }: { status: Status; ms: number | null }) {
  if (status === "idle")
    return <span className="caption text-[var(--color-ink-faint)]">awaiting</span>;
  if (status === "running")
    return <span className="caption text-[var(--color-stamp)]">working...</span>;
  if (status === "error")
    return <span className="caption text-[var(--color-stamp)]">error</span>;
  return (
    <span className="caption text-[var(--color-ink)] tabular-nums">
      done{ms ? ` · ${ms} ms` : ""}
    </span>
  );
}

// ---------- Step 01 source ----------

function SourceClip({ vibe }: { vibe: VibeObject }) {
  const isYouTube = vibe.source.kind === "youtube";
  const isCapture = vibe.source.kind === "capture";
  const url = vibe.source.previewUrl ?? vibe.source.url;
  const title =
    vibe.source.title ??
    (isYouTube ? "youtube" : isCapture ? "your upload" : "source");

  return (
    <div className="grid grid-cols-12 gap-8 items-start">
      <div className="col-span-12 lg:col-span-8">
        <div
          className="relative bg-[var(--color-paper-hi)] p-4 md:p-5"
          style={{ boxShadow: "var(--shadow-paper)" }}
        >
          <span
            className="tape"
            style={{
              top: -12,
              left: 30,
              width: 120,
              height: 24,
              transform: "rotate(-3deg)",
            }}
            aria-hidden
          />

          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ aspectRatio: "16 / 9" }}
          >
            {url ? (
              isYouTube ? (
                <iframe
                  src={url}
                  className="absolute inset-0 w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={title}
                />
              ) : (
                <video
                  src={url}
                  controls
                  playsInline
                  className="absolute inset-0 w-full h-full object-contain"
                />
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center caption text-[var(--color-paper-hi)]">
                no source preview
              </div>
            )}
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-3">
            <span className="display-italic text-[16px] text-[var(--color-ink)] truncate">
              {title}
            </span>
            <span className="caption tabular-nums whitespace-nowrap">
              {vibe.source.kind} ·
              {vibe.source.durationSeconds
                ? ` ${vibe.source.durationSeconds}s`
                : ""}
            </span>
          </div>
        </div>
      </div>

      <aside className="col-span-12 lg:col-span-4 lg:pl-4">
        <p className="caption mb-3">field method</p>
        <ul className="space-y-3">
          <li className="display-italic text-[18px] text-[var(--color-ink-soft)]">
            <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-ink-faint)] mr-3">
              01
            </span>
            sample eight frames at uniform intervals
          </li>
          <li className="display-italic text-[18px] text-[var(--color-ink-soft)]">
            <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-ink-faint)] mr-3">
              02
            </span>
            send to gpt-5.5 with a strict editorial brief
          </li>
          <li className="display-italic text-[18px] text-[var(--color-ink-soft)]">
            <span className="font-mono text-[10px] tracking-[0.22em] text-[var(--color-ink-faint)] mr-3">
              03
            </span>
            return a structured vibe object
          </li>
        </ul>
      </aside>
    </div>
  );
}

// ---------- Step 02 vibe read ----------

function VibeRead({ vibe }: { vibe: VibeObject }) {
  return (
    <div className="space-y-12">
      <div>
        <h1 className="display-xl text-[10vw] md:text-[6vw] lg:text-[88px]">
          {splitTitle(vibe.title)}
        </h1>
        <p className="display-italic mt-6 text-[22px] md:text-[24px] leading-[1.45] text-[var(--color-ink-soft)] max-w-[44ch]">
          {vibe.oneLiner}
        </p>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-5 gap-y-2 caption">
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

      <PaintChips palette={vibe.palette} />

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
          label="weather"
          body={vibe.weatherImplied ?? "indoor weather"}
          className="col-span-12 md:col-span-4"
        />
      </div>

      <div className="grid grid-cols-12 gap-x-10 gap-y-12">
        <div className="col-span-12 md:col-span-5">
          <p className="caption mb-3">soundscape</p>
          <ol className="space-y-3">
            {vibe.soundscape.map((s, i) => (
              <li key={s} className="flex items-baseline gap-4">
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
          <p className="caption mb-3">mood</p>
          <ul className="flex flex-wrap gap-2">
            {vibe.moodTags.map((m, i) => (
              <li
                key={m}
                style={{
                  background: "var(--color-paper-hi)",
                  padding: "6px 12px",
                  boxShadow: "var(--shadow-card)",
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
          <p className="caption mb-3">music anchor</p>
          <dl className="space-y-3">
            <Row k="genre" v={vibe.musicAnchor.genre} />
            <Row k="tempo" v={`${vibe.musicAnchor.tempoBpm} bpm`} mono />
            {vibe.musicAnchor.key ? <Row k="key" v={vibe.musicAnchor.key} mono /> : null}
            {vibe.musicAnchor.referenceTrack ? (
              <Row k="ref." v={vibe.musicAnchor.referenceTrack} italic />
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 03 music ----------

function MusicPanel({
  vibe,
  status,
  err,
  onRun,
}: {
  vibe: VibeObject;
  status: Status;
  err: string | null;
  onRun: () => void;
}) {
  const url = vibe.generatedAssets?.musicUrl;
  const prompt = vibe.generatedAssets?.musicPrompt;
  const lengthMs = vibe.generatedAssets?.musicDurationMs;
  return (
    <div className="grid grid-cols-12 gap-8 items-start">
      <div className="col-span-12 lg:col-span-7">
        <p className="display-md text-[24px] leading-[1.4] text-[var(--color-ink)] max-w-[44ch]">
          ElevenLabs Music will compose {Math.round((lengthMs ?? 90000) / 1000)}{" "}
          seconds of <span className="display-italic">{vibe.musicAnchor.genre}</span>{" "}
          at <span className="font-mono">{vibe.musicAnchor.tempoBpm} bpm</span>,
          tuned to a{" "}
          <span className="display-italic">
            {vibe.density < 0.4 ? "intimate" : vibe.density < 0.7 ? "warm and full" : "busy"}
          </span>{" "}
          room.
        </p>
        {prompt ? (
          <p className="mt-4 caption normal-case tracking-normal text-[var(--color-ink-mute)] max-w-[60ch] leading-[1.6] text-[13px]">
            <span className="caption tracking-[0.18em]">prompt /</span> {prompt}
          </p>
        ) : null}
        {err ? (
          <p className="mt-4 caption text-[var(--color-stamp)]">{err}</p>
        ) : null}
      </div>

      <div className="col-span-12 lg:col-span-5 flex flex-col items-end gap-4">
        <button
          onClick={onRun}
          disabled={status === "running"}
          className="caption-btn"
        >
          {status === "running"
            ? "composing..."
            : status === "done"
            ? "regenerate"
            : "compose music"}
        </button>

        {url ? (
          <div
            className="w-full bg-[var(--color-paper-hi)] p-4"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <p className="caption mb-2">{url.split("/").pop()}</p>
            <audio controls src={url} className="w-full" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Step 04 video ----------

function VideoPanel({
  vibe,
  status,
  err,
  onRun,
  musicAvailable,
  progress,
}: {
  vibe: VibeObject;
  status: Status;
  err: string | null;
  onRun: () => void;
  musicAvailable: boolean;
  progress: VideoProgressState | null;
}) {
  const url = vibe.generatedAssets?.previewVideoUrl;
  const dur = vibe.generatedAssets?.videoDurationSeconds;
  return (
    <div className="grid grid-cols-12 gap-8 items-start">
      <div className="col-span-12 lg:col-span-5">
        <p className="display-md text-[24px] leading-[1.4] text-[var(--color-ink)] max-w-[36ch]">
          GPT Image 2 paints four atmosphere stills, ffmpeg crossfades them with
          a slow Ken Burns drift,{" "}
          {musicAvailable
            ? "your composed music plays underneath"
            : "music will be generated alongside if missing"}
          .
        </p>
        <p className="mt-4 caption">
          stills × 4 · 12s each · 1.2s crossfade · 720p
        </p>
        {err ? (
          <p className="mt-4 caption text-[var(--color-stamp)]">{err}</p>
        ) : null}

        <div className="mt-6">
          <button
            onClick={onRun}
            disabled={status === "running"}
            className="caption-btn"
          >
            {status === "running"
              ? "rendering..."
              : status === "done"
              ? "render again"
              : "render the picture"}
          </button>
        </div>
      </div>

      <div className="col-span-12 lg:col-span-7">
        <div
          className="relative bg-[var(--color-paper-hi)] p-4"
          style={{ boxShadow: "var(--shadow-paper)" }}
        >
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ aspectRatio: "16 / 9" }}
          >
            {url && status !== "running" ? (
              <video
                src={url}
                controls
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : status === "running" ? (
              <VideoProgressOverlay progress={progress} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="display-italic text-[20px] text-[var(--color-paper-hi)]">
                  not yet rendered
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-baseline justify-between gap-3 caption">
            <span>{url ? url.split("/").pop() : "preview placeholder"}</span>
            <span className="tabular-nums">
              {dur ? `${dur}s` : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Step 04 video progress overlay ----------

function VideoProgressOverlay({ progress }: { progress: VideoProgressState | null }) {
  const stage = progress?.stage ?? "brief";
  const percent = Math.max(1, Math.min(100, progress?.percent ?? 1));
  const message = progress?.message ?? "preparing";
  const total = progress?.veoClipsTotal ?? 0;
  const done = progress?.veoClipsCompleted ?? 0;
  const elapsed = progress?.elapsedMs ?? 0;
  const elapsedSec = Math.floor(elapsed / 1000);
  const elapsedDisplay =
    elapsedSec < 60
      ? `${elapsedSec}s`
      : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`;

  // Editorial track: 24 cells. Each cell either filled (oxblood),
  // half-lit (paper-hi), or empty (rule).
  const cells = 24;
  const filled = Math.round((percent / 100) * cells);

  return (
    <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.04),rgba(0,0,0,0.65))]" />
      <div className="relative space-y-4">
        <div className="flex items-baseline gap-3 caption text-[var(--color-paper-hi)]">
          <span className="font-mono text-[10px] tracking-[0.22em]">
            {String(stageOrder(stage)).padStart(2, "0")} / 04
          </span>
          <span className="display-italic text-[18px] text-[var(--color-paper-hi)]">
            {stageLabel(stage)}
          </span>
          {total > 0 ? (
            <span className="font-mono text-[10px] text-[var(--color-paper-hi)] opacity-70 tracking-[0.18em]">
              clip {Math.min(done + (stage === "veo" ? 1 : 0), total)} / {total}
            </span>
          ) : null}
          <span className="ml-auto font-mono text-[11px] tabular-nums text-[var(--color-paper-hi)] opacity-70">
            {elapsedDisplay}
          </span>
        </div>

        <div className="font-mono text-[10px] flex gap-[2px]">
          {Array.from({ length: cells }).map((_, i) => (
            <span
              key={i}
              className="flex-1 h-3 transition-colors duration-300"
              style={{
                background:
                  i < filled
                    ? "var(--color-stamp)"
                    : "rgba(245, 241, 234, 0.18)",
              }}
            />
          ))}
        </div>

        <div className="flex items-baseline justify-between caption text-[var(--color-paper-hi)] opacity-90">
          <span className="normal-case tracking-normal text-[14px] truncate pr-3">
            {message}
          </span>
          <span className="font-mono text-[14px] tabular-nums">
            {percent}%
          </span>
        </div>
      </div>
    </div>
  );
}

function stageOrder(s: VideoProgressState["stage"]): number {
  switch (s) {
    case "brief":
      return 1;
    case "veo":
      return 2;
    case "stitch":
      return 3;
    case "done":
      return 4;
    case "error":
      return 4;
    case "idle":
    default:
      return 1;
  }
}

function stageLabel(s: VideoProgressState["stage"]): string {
  switch (s) {
    case "brief":
      return "creative brief";
    case "veo":
      return "Veo image-to-video chain";
    case "stitch":
      return "stitching with ffmpeg";
    case "done":
      return "complete";
    case "error":
      return "render failed";
    case "idle":
    default:
      return "initialising";
  }
}

// ---------- Step 05 nearby ----------

function Nearby({ places }: { places: Place[] }) {
  return (
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
  );
}

// ---------- helpers ----------

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
