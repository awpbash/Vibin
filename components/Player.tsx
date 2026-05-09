"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApplyPalette } from "@/components/ApplyPalette";
import type { VibeObject } from "@/lib/types";

const FALLBACK_TOTAL = 90; // seconds. Used only when no <video> is present.

export function Player({
  vibe,
  previewUrl,
  musicUrl,
}: {
  vibe: VibeObject;
  previewUrl?: string;
  musicUrl?: string;
}) {
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_TOTAL);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Drive timer either from the actual <video> currentTime or, when no video
  // is present, from a synthetic clock used for the gradient animation only.
  useEffect(() => {
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const v = videoRef.current;
      if (v && previewUrl) {
        setT(v.currentTime);
        if (v.duration && Number.isFinite(v.duration)) setDuration(v.duration);
        if (!v.paused) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
      } else if (playing) {
        setT((prev) => {
          const next = prev + dt;
          if (next >= FALLBACK_TOTAL) {
            setPlaying(false);
            return FALLBACK_TOTAL;
          }
          return next;
        });
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, previewUrl]);

  // Sync video AND music play state when toggled. Video is muted —
  // ElevenLabs-generated music is the soundtrack.
  useEffect(() => {
    const v = videoRef.current;
    const a = audioRef.current;
    if (playing) {
      v?.play().catch(() => setPlaying(false));
      a?.play().catch(() => {
        // Safari/iOS may block — user click anywhere will retry via tap toggle.
      });
    } else {
      v?.pause();
      a?.pause();
    }
  }, [playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.code === "Escape") {
        e.preventDefault();
        history.back();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paletteHexes = vibe.palette.map((c) => c.hex);
  const progress = duration > 0 ? Math.min(100, (t / duration) * 100) : 0;
  const c1 = paletteHexes[1] ?? paletteHexes[0] ?? "#2a2d2a";

  // Mood drives the breath period. Calm/sparse vibes breathe slowly
  // (≈28s for a full cycle), intense/dense ones breathe faster (≈7s).
  // We use density+energy as the "intensity" axis. The wash layers
  // crossfade with offset phase so the room melts between palette
  // colors instead of strobing.
  const tempoBpm = Math.max(40, Math.min(200, vibe.musicAnchor?.tempoBpm || 90));
  const moodIntensity = clamp01(((vibe.density ?? 0.5) + (vibe.energy ?? 0.5)) / 2);
  const cyclePeriod = 28 - moodIntensity * 21; // 28s calm → 7s intense
  const TWO_PI = Math.PI * 2;

  // Per-color layer: opacity and center drift on offset phases.
  const washColors = paletteHexes.slice(0, 4);
  const layers = washColors.map((hex, i) => {
    const phase = (t / cyclePeriod + i / Math.max(1, washColors.length)) * TWO_PI;
    const op = 0.18 + 0.22 * (Math.sin(phase) + 1) / 2; // 0.18..0.40
    const cx = 50 + Math.sin(phase * 0.7) * 28;
    const cy = 50 + Math.cos(phase * 0.9) * 22;
    return { hex, op, cx, cy };
  });

  // Vignette breathes on a longer cycle with a tiny swing — keeps the
  // edges alive without flashing. ~1.5× the wash period.
  const vignettePhase = (t / (cyclePeriod * 1.5)) * TWO_PI;
  const vignetteAlpha = 0.55 + 0.10 * (Math.sin(vignettePhase) + 1) / 2; // 0.55..0.65

  // Ambient lights stay beat-tied (those are Hue, they ARE supposed to
  // pulse) but with a gentler swing and ease-out transitions.
  const beatsPerSec = tempoBpm / 60;
  const beatPhase = (t * beatsPerSec) % 1;
  const beatPulse = Math.max(0, 1 - Math.pow(beatPhase, 0.6));
  const beatIndex = Math.floor(t * beatsPerSec);

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none"
      onClick={() => setPlaying((p) => !p)}
      style={{ background: "#0e0f0e" }}
    >
      <ApplyPalette hexes={paletteHexes} />

      {previewUrl ? (
        <video
          ref={videoRef}
          src={previewUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      {musicUrl ? (
        <audio
          ref={audioRef}
          src={musicUrl}
          autoPlay
          loop
          preload="auto"
          onLoadedMetadata={(e) => {
            // Prefer music duration over video when present (music is
            // the canonical playback length; video loops underneath).
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && !previewUrl) setDuration(d);
          }}
        />
      ) : null}

      {/* Layered palette breath — one radial gradient per palette color,
          each crossfading on its own phase. The room melts between
          colors over `cyclePeriod` seconds (long for calm vibes, short
          for intense ones) instead of strobing per beat. */}
      <div className="absolute inset-0 pointer-events-none">
        {layers.map((L, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 75% 55% at ${L.cx}% ${L.cy}%, ${L.hex} 0%, transparent 60%)`,
              opacity: previewUrl ? L.op * 0.9 : Math.min(0.55, L.op * 1.6),
              mixBlendMode: previewUrl ? "soft-light" : "normal",
              transition: "opacity 1200ms ease-in-out",
              willChange: "opacity",
            }}
          />
        ))}
        {/* Solid base when there's no video so the screen never goes black */}
        {previewUrl ? null : (
          <div
            className="absolute inset-0"
            style={{ background: "#0e0f0e", zIndex: -1 }}
          />
        )}
      </div>

      {/* Slow Ken-Burns drift on the whole gradient stack */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          transform: `scale(${1 + (t / Math.max(duration, 1)) * 0.12})`,
          transformOrigin: "55% 50%",
          transition: "transform 800ms linear",
        }}
      />

      {/* Slow drifting line bands — angle creeps over time, no per-frame thrash */}
      <div
        className="absolute inset-0 mix-blend-screen opacity-25 pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            ${30 + t * 0.25}deg,
            transparent 0px,
            transparent 90px,
            ${c1}1a 90px,
            ${c1}1a 91px
          )`,
          transition: "background 1200ms linear",
        }}
      />

      {/* Vignette — palette-tinted edge, very gentle long breath */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, transparent 45%, ${c1}${toHexAlpha(vignetteAlpha)} 100%)`,
          transition: "background 1500ms ease-in-out",
        }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          opacity: 0.5,
        }}
      />

      {/* Top bar — with safe area inset for iPhone notch */}
      <div
        className="absolute top-0 inset-x-0 px-6 md:px-14 flex items-baseline justify-between"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top, 0px))" }}
      >
        <Link
          href={`/v/${vibe.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e9dcc6]/70 hover:text-[#e9dcc6] transition-colors"
        >
          ← back
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e9dcc6]/60 flex items-baseline gap-4">
          <span className="hidden sm:inline">now playing</span>
          <span className="tabular-nums">
            {fmt(t)} / {fmt(duration)}
          </span>
        </div>
      </div>

      {/* Ambient lights panel — palette-bulbs that pulse with the beat.
          Sells the "casts to your Hue lights" pitch beat without needing
          real hardware on stage. */}
      <AmbientLightsPanel
        hexes={paletteHexes}
        pulse={beatPulse}
        beatIndex={beatIndex}
        tempoBpm={tempoBpm}
      />

      {/* Title + progress — with safe area inset for iPhone home indicator */}
      <div
        className="absolute bottom-0 inset-x-0 px-6 md:px-14"
        style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <p className="font-mono text-[10px] md:text-[11px] uppercase tracking-[0.22em] text-[#e9dcc6]/50 mb-3 md:mb-4">
          {vibe.musicAnchor.genre} · {vibe.musicAnchor.tempoBpm} bpm
          {vibe.musicAnchor.key ? ` · ${vibe.musicAnchor.key}` : ""}
        </p>
        <h1
          className="display-xl text-[13vw] md:text-[7.5vw] leading-[0.92] text-[#f5f1ea]"
          style={{ textShadow: "0 1px 30px rgba(0,0,0,0.4)" }}
        >
          {vibe.title}
        </h1>
        <div className="mt-5 md:mt-8 flex items-end justify-between border-t border-[#e9dcc6]/15 pt-4 gap-4">
          <span className="display-italic text-[16px] md:text-[18px] text-[#e9dcc6]/80 max-w-[34ch]">
            {vibe.oneLiner}
          </span>
          <span className="font-mono text-[9px] md:text-[10px] uppercase tracking-[0.18em] text-[#e9dcc6]/50 shrink-0 hidden sm:inline">
            {playing ? "tap to pause" : "tap to play"}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-5 md:mt-6 h-px w-full bg-[#e9dcc6]/15 relative">
          <div
            className="absolute left-0 top-0 h-px"
            style={{
              width: `${progress}%`,
              background: "var(--vibe-accent, var(--color-accent))",
              transition: "width 100ms linear",
            }}
          />
        </div>

        {/* Mobile tap hint */}
        <p className="sm:hidden font-mono text-[9px] uppercase tracking-[0.18em] text-[#e9dcc6]/40 mt-3 text-center">
          {playing ? "tap to pause" : "tap to play"}
        </p>
      </div>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function toHexAlpha(a: number): string {
  const v = Math.max(0, Math.min(1, a));
  return Math.round(v * 255)
    .toString(16)
    .padStart(2, "0");
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Floating top-right card. Three to four bulb dots, one per palette
// color, each pulsing with the beat. Lead bulb — the one tied to the
// "downbeat" — flares brighter on each new beat. Subtitle cycles
// "casting → living room" → "casting → desk lamp" with a small WiFi
// icon to sell the integration story.
function AmbientLightsPanel({
  hexes,
  pulse,
  beatIndex,
  tempoBpm,
}: {
  hexes: string[];
  pulse: number;
  beatIndex: number;
  tempoBpm: number;
}) {
  const bulbs = hexes.slice(0, 4);
  if (bulbs.length === 0) return null;
  const rooms = ["living room", "desk lamp", "kitchen", "reading nook"];
  const room = rooms[beatIndex % rooms.length];

  return (
    <div
      className="absolute top-[calc(1.5rem+env(safe-area-inset-top,0px))] right-6 md:right-14 z-10 hidden sm:block"
      onClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex items-center gap-3 px-3 py-2 border border-[#e9dcc6]/15 backdrop-blur-md"
        style={{ background: "rgba(14,15,14,0.55)" }}
      >
        <CastIcon />
        <div className="flex items-center gap-1.5">
          {bulbs.map((hex, i) => {
            const isLead = i === beatIndex % bulbs.length;
            // Gentler swing than before — bulbs warm/cool, never strobe.
            const intensity = isLead ? 0.7 + pulse * 0.2 : 0.55 + pulse * 0.08;
            const scale = isLead ? 1 + pulse * 0.18 : 1 + pulse * 0.05;
            return (
              <span
                key={i}
                className="block rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background: hex,
                  opacity: intensity,
                  transform: `scale(${scale})`,
                  boxShadow: `0 0 ${Math.round(6 + pulse * 8)}px ${hex}`,
                  transition:
                    "transform 320ms ease-out, opacity 320ms ease-out, box-shadow 320ms ease-out",
                }}
              />
            );
          })}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#e9dcc6]/85">
            casting · {bulbs.length} bulbs
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#e9dcc6]/55">
            → {room} · {tempoBpm} bpm
          </span>
        </div>
      </div>
    </div>
  );
}

function CastIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden
      className="text-[#e9dcc6]/85"
    >
      <path
        d="M2 5 V3 H14 V13 H10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="square"
      />
      <path
        d="M2 8 a4 4 0 0 1 4 4 M2 11 a1.5 1.5 0 0 1 1.5 1.5 M2 13 h0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
