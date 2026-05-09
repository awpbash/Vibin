"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApplyPalette } from "@/components/ApplyPalette";
import type { VibeObject } from "@/lib/types";

const TOTAL = 90; // seconds. Preview length.

export function Player({
  vibe,
  previewUrl,
}: {
  vibe: VibeObject;
  previewUrl?: string;
}) {
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  const ref = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const pausedAt = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      pausedAt.current = t;
      if (ref.current) cancelAnimationFrame(ref.current);
      return;
    }
    startRef.current = performance.now();
    const tick = (now: number) => {
      const elapsed = pausedAt.current + (now - startRef.current) / 1000;
      if (elapsed >= TOTAL) {
        setT(TOTAL);
        setPlaying(false);
        return;
      }
      setT(elapsed);
      ref.current = requestAnimationFrame(tick);
    };
    ref.current = requestAnimationFrame(tick);
    return () => {
      if (ref.current) cancelAnimationFrame(ref.current);
    };
  }, [playing, t]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const paletteHexes = vibe.palette.map((c) => c.hex);
  const progress = (t / TOTAL) * 100;
  const c0 = paletteHexes[0] ?? "#1a1d1a";
  const c1 = paletteHexes[1] ?? "#2a2d2a";
  const c2 = paletteHexes[2] ?? "#1a1d1a";
  const c3 = paletteHexes[3] ?? c1;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden cursor-pointer select-none"
      onClick={() => setPlaying((p) => !p)}
      style={{ background: "#0e0f0e" }}
    >
      <ApplyPalette hexes={paletteHexes} />

      {previewUrl ? (
        <video
          src={previewUrl}
          autoPlay
          loop
          muted={false}
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : null}

      {/* Cinematic background: layered radial gradients of the palette,
          slow zoom for Ken Burns effect. Hidden when a real preview plays. */}
      <div
        className={`absolute inset-0 ${previewUrl ? "opacity-0" : ""}`}
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 25% 25%, ${c0}aa 0%, transparent 60%),
            radial-gradient(ellipse 60% 50% at 75% 80%, ${c1}aa 0%, transparent 55%),
            radial-gradient(ellipse 50% 40% at 60% 40%, ${c2}55 0%, transparent 60%),
            radial-gradient(ellipse 40% 30% at 30% 70%, ${c3}55 0%, transparent 55%),
            #0e0f0e
          `,
          transform: `scale(${1 + (t / TOTAL) * 0.18})`,
          transformOrigin: "55% 50%",
          transition: "transform 250ms linear, opacity 600ms ease",
        }}
      />

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

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 50%, rgba(0,0,0,0.6) 100%)",
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
            {fmt(t)} / {fmt(TOTAL)}
          </span>
        </div>
      </div>

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
