"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ApplyPalette } from "@/components/ApplyPalette";
import type { VibeObject } from "@/lib/types";

const FALLBACK_TOTAL = 90; // seconds. Used only when no <video> is present.

export function Player({
  vibe,
  previewUrl,
}: {
  vibe: VibeObject;
  previewUrl?: string;
}) {
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  const [duration, setDuration] = useState(FALLBACK_TOTAL);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Sync video play state when toggled.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.play().catch(() => setPlaying(false));
    else v.pause();
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
          playsInline
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d)) setDuration(d);
          }}
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
          transform: `scale(${1 + (t / Math.max(duration, 1)) * 0.18})`,
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

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 px-8 md:px-14 py-8 flex items-baseline justify-between">
        <Link
          href={`/v/${vibe.id}`}
          onClick={(e) => e.stopPropagation()}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e9dcc6]/70 hover:text-[#e9dcc6] transition-colors"
        >
          ← back
        </Link>
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e9dcc6]/60 flex items-baseline gap-4">
          <span>now playing</span>
          <span className="tabular-nums">
            {fmt(t)} / {fmt(duration)}
          </span>
        </div>
      </div>

      {/* Title */}
      <div className="absolute bottom-0 inset-x-0 px-8 md:px-14 pb-12 md:pb-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#e9dcc6]/50 mb-4">
          {vibe.musicAnchor.genre} · {vibe.musicAnchor.tempoBpm} bpm
          {vibe.musicAnchor.key ? ` · ${vibe.musicAnchor.key}` : ""}
        </p>
        <h1
          className="display-xl text-[12vw] md:text-[7.5vw] leading-[0.92] text-[#f5f1ea]"
          style={{ textShadow: "0 1px 30px rgba(0,0,0,0.4)" }}
        >
          {vibe.title}
        </h1>
        <div className="mt-8 flex items-baseline justify-between border-t border-[#e9dcc6]/15 pt-4">
          <span className="display-italic text-[18px] text-[#e9dcc6]/80 max-w-[40ch]">
            {vibe.oneLiner}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#e9dcc6]/50">
            {playing ? "click to pause · space" : "click to play · space"}
          </span>
        </div>

        {/* Progress */}
        <div className="mt-6 h-px w-full bg-[#e9dcc6]/15 relative">
          <div
            className="absolute left-0 top-0 h-px"
            style={{
              width: `${progress}%`,
              background: "var(--vibe-accent, var(--color-accent))",
              transition: "width 100ms linear",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}
