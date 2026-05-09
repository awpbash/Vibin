"use client";

// Fires POST /api/generate/video once on mount when the vibe has no
// previewVideoUrl yet, then polls /api/generate/video/progress every 2s
// to render a visible progress banner. On completion, calls
// router.refresh() so the server-rendered vibe page picks up the URL.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "idle" | "brief" | "veo" | "stitch" | "done" | "error";

type Progress = {
  stage: Stage;
  percent: number;
  message: string | null;
  error: string | null;
  veoClipsTotal: number;
  veoClipsCompleted: number;
  elapsedMs: number;
};

const STAGE_LABEL: Record<Stage, string> = {
  idle: "queued",
  brief: "preparing creative brief",
  veo: "rendering video",
  stitch: "stitching",
  done: "complete",
  error: "failed",
};

export function AutoGenerateVideo({
  vibeId,
  hasVideo,
}: {
  vibeId: string;
  hasVideo: boolean;
}) {
  const router = useRouter();
  const triggeredRef = useRef(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (triggeredRef.current) return;
    triggeredRef.current = true;
    if (hasVideo) return;

    fetch("/api/generate/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vibeId }),
    }).catch(() => {
      // server-side failure — progress endpoint will surface it
    });
  }, [vibeId, hasVideo]);

  useEffect(() => {
    if (hasVideo || dismissed) return;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const r = await fetch(`/api/generate/video/progress?vibeId=${vibeId}`);
        if (!r.ok) return;
        const j = (await r.json()) as Progress;
        if (cancelled) return;
        setProgress(j);
        if (j.stage === "done") {
          if (interval) clearInterval(interval);
          // Let the user see "complete" briefly, then refresh so the
          // server fetch picks up previewVideoUrl.
          setTimeout(() => {
            if (!cancelled) router.refresh();
          }, 800);
        }
        if (j.stage === "error") {
          if (interval) clearInterval(interval);
        }
      } catch {
        // transient — try again on next tick
      }
    };

    poll();
    interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [vibeId, hasVideo, dismissed, router]);

  if (hasVideo || dismissed) return null;
  if (!progress || progress.stage === "idle") {
    // Faint pre-roll banner so the user sees SOMETHING immediately.
    return (
      <Banner
        label="rendering video"
        message="warming up the model"
        percent={2}
        onDismiss={() => setDismissed(true)}
      />
    );
  }

  const elapsed = Math.floor(progress.elapsedMs / 1000);
  const isError = progress.stage === "error";
  const message = isError
    ? progress.error ?? "video gen failed — see server logs"
    : progress.message ??
      (progress.stage === "veo" && progress.veoClipsTotal > 0
        ? `clip ${progress.veoClipsCompleted}/${progress.veoClipsTotal}`
        : STAGE_LABEL[progress.stage]);

  return (
    <Banner
      label={STAGE_LABEL[progress.stage]}
      message={`${message} · ${elapsed}s`}
      percent={isError ? 0 : progress.percent}
      isError={isError}
      onDismiss={() => setDismissed(true)}
    />
  );
}

function Banner({
  label,
  message,
  percent,
  isError,
  onDismiss,
}: {
  label: string;
  message: string;
  percent: number;
  isError?: boolean;
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--color-rule)]"
      style={{
        background: "var(--color-paper-hi)",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="px-6 md:px-14 lg:px-20 py-2.5 flex items-center gap-4">
        <span
          className={`shrink-0 w-2 h-2 rounded-full ${
            isError ? "bg-[var(--color-stamp)]" : "bg-[var(--color-stamp)] animate-pulse"
          }`}
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink)]">
            {label}
          </p>
          <p className="font-mono text-[10px] text-[var(--color-ink-mute)] truncate">
            {message}
          </p>
        </div>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink-mute)]">
          {Math.round(percent)}%
        </span>
        <button
          onClick={onDismiss}
          aria-label="hide progress"
          className="shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)] hover:text-[var(--color-ink)] transition-colors"
        >
          hide
        </button>
      </div>
      <div className="h-[2px] bg-[var(--color-rule-soft)]">
        <div
          className="h-full bg-[var(--color-stamp)] transition-[width] duration-300"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
