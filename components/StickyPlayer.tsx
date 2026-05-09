"use client";

// Bottom-fixed audio player on every vibe page. On first load it auto-
// triggers music generation if the vibe has no musicUrl yet, while the
// reader explores the page above. Once music exists it auto-plays
// (muted-then-unmuted on first interaction, per browser autoplay rules)
// and lets the reader toggle between the generated music and the 30s
// source sample for direct A/B.

import { useCallback, useEffect, useRef, useState } from "react";

type Status = "idle" | "running" | "done" | "error";

type Source = "generated" | "sample";

export function StickyPlayer({
  vibeId,
  initialMusicUrl,
  audioSampleUrl,
}: {
  vibeId: string;
  initialMusicUrl?: string | null;
  audioSampleUrl?: string | null;
}) {
  const [musicUrl, setMusicUrl] = useState<string | undefined>(
    initialMusicUrl ?? undefined,
  );
  const [genStatus, setGenStatus] = useState<Status>(
    initialMusicUrl ? "done" : "idle",
  );
  const [genErr, setGenErr] = useState<string | null>(null);

  const [source, setSource] = useState<Source>(
    initialMusicUrl ? "generated" : audioSampleUrl ? "sample" : "generated",
  );
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const triggeredRef = useRef(false);

  const url = source === "generated" ? musicUrl : audioSampleUrl ?? undefined;

  // Auto-trigger music gen on first mount if the vibe doesn't have it.
  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    if (musicUrl) return;
    setGenStatus("running");
    fetch("/api/generate/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vibeId }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || r.statusText);
        return j as { musicUrl: string };
      })
      .then((j) => {
        setMusicUrl(j.musicUrl);
        setSource("generated");
        setGenStatus("done");
      })
      .catch((e) => {
        setGenErr(e instanceof Error ? e.message : "music gen failed");
        setGenStatus("error");
      });
  }, [vibeId, musicUrl]);

  // Auto-play (muted) once a URL becomes available. Browser will allow
  // muted autoplay; the user clicks volume to unmute.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !url) return;
    el.muted = muted;
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, [url, muted]);

  const onTime = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.duration || !isFinite(el.duration)) return;
    setProgress(el.currentTime / el.duration);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, []);

  const switchSource = useCallback(
    (s: Source) => {
      if (s === source) return;
      setSource(s);
      setProgress(0);
    },
    [source],
  );

  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={onTime}
        onEnded={() => setPlaying(false)}
        preload="auto"
        loop={source === "sample"}
      />

      <div
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-rule)]"
        style={{
          background: "var(--color-paper-hi)",
          backdropFilter: "saturate(110%)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {/* Progress hairline along the very top edge */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[var(--color-rule-soft)]">
          <div
            className="absolute top-0 left-0 h-full bg-[var(--color-stamp)] transition-[width] duration-100"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>

        <div className="px-6 md:px-14 lg:px-20 py-3 flex items-center gap-4 md:gap-6">
          {/* Transport */}
          <button
            onClick={togglePlay}
            disabled={!url}
            aria-label={playing ? "pause" : "play"}
            className="shrink-0 w-10 h-10 rounded-full border border-[var(--color-ink)] flex items-center justify-center disabled:opacity-30 hover:bg-[var(--color-ink)] hover:text-[var(--color-paper-hi)] transition-colors"
          >
            {playing ? (
              <span className="block w-3 h-3 border-l-2 border-r-2 border-current" />
            ) : (
              <span
                className="block w-0 h-0 ml-[2px]"
                style={{
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderLeft: "10px solid currentColor",
                }}
              />
            )}
          </button>

          {/* Now-playing label + status */}
          <div className="min-w-0 flex-1">
            <p className="display-italic text-[16px] md:text-[18px] truncate text-[var(--color-ink)]">
              {source === "generated"
                ? genStatus === "running"
                  ? "composing music…"
                  : genStatus === "error"
                    ? "music gen failed"
                    : "generated · vibe music"
                : "30 second source sample"}
            </p>
            <p className="caption truncate">
              {source === "generated"
                ? genStatus === "error"
                  ? genErr ?? "tap retry"
                  : genStatus === "running"
                    ? "elevenlabs · lyria · live"
                    : "85s · multi-bridge · sfx layer underneath"
                : "from the original recording, looped"}
            </p>
          </div>

          {/* Source toggle */}
          <div className="hidden sm:flex items-stretch border border-[var(--color-rule)] text-[10px] tracking-[0.18em] uppercase font-mono">
            <button
              onClick={() => switchSource("generated")}
              disabled={!musicUrl}
              className={`px-3 py-2 transition-colors ${
                source === "generated"
                  ? "bg-[var(--color-ink)] text-[var(--color-paper-hi)]"
                  : "text-[var(--color-ink-mute)] hover:text-[var(--color-ink)]"
              } disabled:opacity-30`}
            >
              gen
            </button>
            <button
              onClick={() => switchSource("sample")}
              disabled={!audioSampleUrl}
              className={`px-3 py-2 border-l border-[var(--color-rule)] transition-colors ${
                source === "sample"
                  ? "bg-[var(--color-ink)] text-[var(--color-paper-hi)]"
                  : "text-[var(--color-ink-mute)] hover:text-[var(--color-ink)]"
              } disabled:opacity-30`}
              title="play 30 seconds of the actual source audio"
            >
              source
            </button>
          </div>

          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            disabled={!url}
            aria-label={muted ? "unmute" : "mute"}
            className="shrink-0 caption text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] disabled:opacity-30 px-2"
          >
            {muted ? "tap to hear" : "vol"}
          </button>
        </div>
      </div>
    </>
  );
}
