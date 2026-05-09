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
  const c0 = paletteHexes[0] ?? "#1a1d1a";
  const c1 = paletteHexes[1] ?? "#2a2d2a";
  const c2 = paletteHexes[2] ?? "#1a1d1a";
  const c3 = paletteHexes[3] ?? c1;

  // Beat-driven pulse. Tempo from the same VibeObject the palette came
  // from — so the room visibly breathes with the music. We compute
  // phase ∈ [0,1) per beat, then a sharp-attack/slow-decay curve so it
  // reads as a heartbeat rather than a sine wave.
  const tempoBpm = Math.max(40, Math.min(200, vibe.musicAnchor?.tempoBpm || 90));
  const beatsPerSec = tempoBpm / 60;
  const beatPhase = (t * beatsPerSec) % 1;
  // 1.0 at the downbeat → decays to ~0.15 by the end of the beat
  const pulse = Math.max(0.15, 1 - Math.pow(beatPhase, 0.5));
  const beatIndex = Math.floor(t * beatsPerSec);

  // Map pulse to per-effect intensities.
  const washOpacity = 0.4 + pulse * 0.35; // wash 0.40 → 0.75
  const vignetteAlpha = 0.55 + pulse * 0.35; // vignette 0.55 → 0.90 (hex aa..ee)

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

      {/* Cinematic background: layered radial gradients of the palette,
          slow zoom for Ken Burns effect. When a video plays we keep the
          gradient on top at lower opacity with a multiply blend so the
          palette tints the footage instead of being hidden. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 25% 25%, ${c0}aa 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 75% 80%, ${c1}aa 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 60% 40%, ${c2}55 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 30% 70%, ${c3}55 0%, transparent 55%),
            ${previewUrl ? "transparent" : "#0e0f0e"}
          `,
          transform: `scale(${1 + (t / Math.max(duration, 1)) * 0.18})`,
          transformOrigin: "55% 50%",
          transition: "transform 250ms linear, opacity 600ms ease",
          mixBlendMode: previewUrl ? "soft-light" : "normal",
          opacity: previewUrl ? 0.85 : 1,
        }}
      />

      {/* Palette wash — second pass on top of the video at screen blend
          so the dominant accent colors lift visibly through the footage.
          Opacity pulses with the beat so the room breathes with the music. */}
      {previewUrl ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 30% 30%, ${c0}77 0%, transparent 60%),
              radial-gradient(ellipse 70% 60% at 70% 75%, ${c1}77 0%, transparent 55%)
            `,
            mixBlendMode: "screen",
            opacity: washOpacity,
            transition: "opacity 80ms linear",
          }}
        />
      ) : null}

      {/* Slow drifting bands */}
      <div
        className="absolute inset-0 mix-blend-screen opacity-40"
        style={{
          background: `repeating-linear-gradient(
            ${30 + t * 0.5}deg,
            transparent 0px,
            transparent 80px,
            ${c1}22 80px,
            ${c1}22 81px
          )`,
        }}
      />

      {/* Vignette — palette-tinted edge so the corners read as the
          dominant accent. The alpha breathes with the beat. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, transparent 45%, ${c1}${toHexAlpha(vignetteAlpha)} 100%)`,
          transition: "background 80ms linear",
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
        pulse={pulse}
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
            const intensity = isLead ? 0.55 + pulse * 0.45 : 0.45 + pulse * 0.2;
            const scale = isLead ? 1 + pulse * 0.35 : 1 + pulse * 0.12;
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
                  boxShadow: `0 0 ${Math.round(8 + pulse * 14)}px ${hex}`,
                  transition: "transform 80ms linear, opacity 80ms linear, box-shadow 80ms linear",
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
