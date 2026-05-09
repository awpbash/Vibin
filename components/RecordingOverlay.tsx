"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "requesting" | "preview" | "recording" | "error";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onUploadFallback: () => void;
};

function getBestMimeType(): string {
  for (const t of [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ]) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t;
    } catch {
      // ignore
    }
  }
  return "";
}

export function RecordingOverlay({ onCapture, onClose, onUploadFallback }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("requesting");
  const [countdown, setCountdown] = useState(15);
  const [errorMsg, setErrorMsg] = useState("");

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setPhase("preview");
      })
      .catch((err: Error) => {
        if (cancelledRef.current) return;
        setErrorMsg(
          err.name === "NotAllowedError"
            ? "camera access denied."
            : "camera not available on this device.",
        );
        setPhase("error");
      });

    return () => {
      cancelledRef.current = true;
      stopStream();
    };
  }, [stopStream]);

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = getBestMimeType();
    const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);
    mrRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = () => {
      if (cancelledRef.current) return;
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      const type = mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type });
      const file = new File([blob], `clip.${ext}`, { type });
      stopStream();
      onCapture(file);
    };

    mr.start(1000);
    setPhase("recording");
    setCountdown(15);

    let remaining = 15;
    timerRef.current = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current!);
        mr.stop();
      }
    }, 1000);
  }

  function finishEarly() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mrRef.current?.state === "recording") mrRef.current.stop();
  }

  function handleClose() {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (mrRef.current?.state === "recording") mrRef.current.stop();
    stopStream();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overlay-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(28,24,20,0.92)" }}
        onClick={handleClose}
      />

      {/* Viewfinder */}
      <div className="relative w-full max-w-[640px] mx-5 md:mx-10">
        {/* Video preview */}
        <div className="relative aspect-video bg-[var(--color-ink)] overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Corner brackets */}
          <span className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[var(--color-stamp)]" aria-hidden />
          <span className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[var(--color-stamp)]" aria-hidden />
          <span className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[var(--color-stamp)]" aria-hidden />
          <span className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[var(--color-stamp)]" aria-hidden />

          {/* REC indicator */}
          {phase === "recording" && (
            <>
              <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none">
                <span
                  className="block rounded-full pulse-soft"
                  style={{ width: 8, height: 8, background: "var(--color-stamp)" }}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white opacity-90">
                  rec
                </span>
              </div>
              <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
                <span className="font-mono text-[13px] tracking-[0.12em] text-white opacity-70">
                  {countdown}s remaining
                </span>
              </div>
            </>
          )}

          {/* Status overlay for requesting / error states */}
          {(phase === "requesting" || phase === "error") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-faint)]">
                {phase === "requesting" ? "requesting camera…" : errorMsg}
              </p>
              {phase === "error" && (
                <button
                  onClick={() => { handleClose(); onUploadFallback(); }}
                  className="recorder-btn font-mono text-[10px] uppercase tracking-[0.2em] px-5 py-2"
                >
                  upload a file instead
                </button>
              )}
            </div>
          )}
        </div>

        {/* Controls row */}
        <div className="mt-5 flex items-center justify-between gap-4" style={{ minHeight: 44 }}>
          <button
            onClick={() => { handleClose(); onUploadFallback(); }}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)] hover:text-[var(--color-paper-hi)] transition-colors shrink-0"
          >
            upload file
          </button>

          <div className="flex justify-center flex-1">
            {phase === "preview" && (
              <button onClick={startRecording} className="recorder-btn font-mono text-[11px] uppercase tracking-[0.2em] px-8 py-3">
                start recording
              </button>
            )}
            {phase === "recording" && (
              <button onClick={finishEarly} className="recorder-btn-ghost font-mono text-[11px] uppercase tracking-[0.2em] px-8 py-3">
                done · <span className="tabular-nums">{countdown}s</span>
              </button>
            )}
          </div>

          <button
            onClick={handleClose}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)] hover:text-[var(--color-paper-hi)] transition-colors shrink-0"
          >
            cancel
          </button>
        </div>

        {/* Eyebrow label */}
        <p className="mt-4 text-center font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-faint)] opacity-60">
          viber · field unit · singapore
        </p>
      </div>
    </div>
  );
}
