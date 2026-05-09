"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { SAMPLES } from "@/lib/samples";

type Phase = "idle" | "uploading" | "sensing" | "done" | "error";

export function MobileActionBar() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function go(input: { file?: File; url?: string }) {
    setError(null);
    startTransition(async () => {
      try {
        let res: Response;
        if (input.file) {
          setPhase("uploading");
          const fd = new FormData();
          fd.append("video", input.file);
          res = await fetch("/api/extract", { method: "POST", body: fd });
        } else if (input.url?.trim()) {
          setPhase("sensing");
          res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input.url }),
          });
        } else return;

        setPhase("sensing");
        if (!res.ok) throw new Error(await res.text());
        const { vibeId } = (await res.json()) as { vibeId: string };
        setPhase("done");
        router.push(`/v/${vibeId}`);
      } catch (e) {
        setPhase("error");
        setError(e instanceof Error ? e.message : "something went wrong");
      }
    });
  }

  const busy = pending || phase === "uploading" || phase === "sensing";

  const statusText = busy
    ? phase === "uploading"
      ? "uploading clip..."
      : "sensing the vibe..."
    : "fifteen seconds is enough";

  return (
    /* Only visible on mobile — hidden at md breakpoint */
    <div className="md:hidden fixed bottom-0 inset-x-0 z-50">
      {/* Slide-up URL drawer */}
      {drawerOpen && (
        <div className="mobile-drawer px-5 pt-5 pb-4">
          {/* Sample thumbnails */}
          <div className="flex gap-4 overflow-x-auto pb-4 mb-4 border-b border-dotted border-[var(--color-rule-soft)]">
            <span className="caption pt-3 shrink-0">try one</span>
            {SAMPLES.map((s, i) => (
              <button
                key={s.url}
                onClick={() => {
                  setUrl(s.url);
                  go({ url: s.url });
                  setDrawerOpen(false);
                }}
                disabled={busy}
                className="flex flex-col items-center gap-1.5 shrink-0 disabled:opacity-40"
              >
                <span
                  className="block border-[3px] border-[var(--color-paper-hi)]"
                  style={{
                    width: 52,
                    height: 52,
                    backgroundImage: `url(${s.thumb})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    boxShadow: "var(--shadow-card)",
                    transform: `rotate(${i % 2 === 0 ? -3 : 2.5}deg)`,
                  }}
                  aria-hidden
                />
                <span className="display-italic text-[13px] text-[var(--color-ink)] max-w-[60px] text-center leading-[1.2]">
                  {s.label}
                </span>
              </button>
            ))}
          </div>

          {/* URL input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) {
                go({ url });
                setDrawerOpen(false);
              }
            }}
            className="field-input-wrap flex items-center gap-3 border-b border-[var(--color-rule)] pb-3"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)] shrink-0">
              url /
            </span>
            <input
              autoFocus
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="any youtube link"
              className="field-input text-[18px]"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !url.trim()}
              className="font-mono text-[10px] uppercase tracking-[0.2em] shrink-0 text-[var(--color-ink)] disabled:opacity-30"
            >
              go →
            </button>
          </form>

          {error && (
            <p className="font-mono text-[10px] text-[var(--color-stamp)] mt-3">{error}</p>
          )}
        </div>
      )}

      {/* Main bar */}
      <div
        className="mobile-bar px-5 flex items-center justify-between gap-4"
        style={{ paddingTop: 14, paddingBottom: `calc(14px + env(safe-area-inset-bottom, 0px))` }}
      >
        {/* Left: status + drawer toggle */}
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-mute)] truncate">
            {statusText}
          </p>
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] link-underline mt-1 block"
            style={{ minHeight: "auto", minWidth: "auto" }}
          >
            {drawerOpen ? "close ↓" : "or paste a link"}
          </button>
        </div>

        {/* Right: record button */}
        <button
          onClick={() => {
            if (!busy) fileRef.current?.click();
          }}
          disabled={busy}
          aria-label="record or upload a clip"
          className={`shrink-0 relative flex items-center justify-center rounded-full transition-transform duration-150 active:scale-90 disabled:opacity-60 ${!busy ? "record-pulse" : ""}`}
          style={{
            width: 64,
            height: 64,
            background: busy
              ? "var(--color-ink-mute)"
              : "var(--color-stamp)",
            boxShadow: busy
              ? "none"
              : "0 4px 20px rgba(168,46,26,0.38), 0 1px 4px rgba(28,24,20,0.18)",
          }}
        >
          {busy ? (
            <span
              className="font-mono text-[var(--color-paper-hi)] uppercase tracking-[0.12em]"
              style={{ fontSize: 11 }}
            >
              {phase === "uploading" ? "↑" : "···"}
            </span>
          ) : (
            /* Inner white dot — the "record" icon */
            <span
              className="block rounded-full bg-[var(--color-paper-hi)]"
              style={{ width: 22, height: 22, opacity: 0.92 }}
            />
          )}

          {/* Outer ring */}
          <span
            className="absolute inset-0 rounded-full border-2 border-[var(--color-paper-hi)] opacity-25"
            aria-hidden
          />
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) go({ file: f });
        }}
      />
    </div>
  );
}
