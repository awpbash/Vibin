"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { StampButton } from "./StampButton";

const SAMPLES: Array<{ label: string; url: string; thumb: string }> = [
  {
    label: "tokyo coffee shop",
    url: "https://www.youtube.com/watch?v=dx9aDku80kM",
    thumb:
      "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=240&q=70",
  },
  {
    label: "lisbon jazz bar",
    url: "https://www.youtube.com/watch?v=lLxK5fEzaAU",
    thumb:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=240&q=70",
  },
  {
    label: "midnight hawker",
    url: "https://www.youtube.com/watch?v=pBKlFnh96Tg",
    thumb:
      "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=240&q=70",
  },
];

type Phase = "idle" | "uploading" | "sensing" | "done" | "error";

export function VibeInput() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
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
          // The upload finished; now waiting on the model.
          setPhase("sensing");
        } else if (input.url?.trim()) {
          setPhase("sensing");
          res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input.url }),
          });
        } else return;

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

  return (
    <div className="flex flex-col items-start gap-7">
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

      <StampButton
        primary={busy ? "sensing" : "sense"}
        secondary={
          phase === "uploading"
            ? "uploading clip"
            : phase === "sensing"
            ? "reading the room"
            : phase === "error"
            ? "tap to retry"
            : "tap to record / upload"
        }
        serial="ed. 001 / sg"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        busy={busy}
      />

      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-ink-mute)] max-w-[44ch]">
        fifteen seconds is enough. record any room you like and we will read
        the palette, the soundscape, the music, the mood.
      </p>

      <div className="w-full max-w-[42rem] mt-4">
        <div className="flex items-baseline gap-3 mb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)]">
            or, paste a clip you love
          </span>
          <span className="flex-1 border-t border-dotted border-[var(--color-rule-soft)]" />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go({ url });
          }}
          className="flex items-baseline gap-4 border-b border-[var(--color-rule)] pb-3"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)] pt-2">
            url /
          </span>
          <input
            spellCheck={false}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="any youtube link"
            className="field-input"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink)] hover:text-[var(--color-stamp)] transition-colors pt-2 disabled:opacity-40"
          >
            {busy ? "..." : "go"}
          </button>
        </form>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-3">
          <span className="caption pt-2">try one</span>
          {SAMPLES.map((s, i) => (
            <button
              key={s.url}
              onClick={() => {
                setUrl(s.url);
                go({ url: s.url });
              }}
              disabled={busy}
              className="group inline-flex items-center gap-2 disabled:opacity-40"
            >
              <span
                className="block w-8 h-8 bg-cover bg-center"
                style={{ backgroundImage: `url(${s.thumb})` }}
                aria-hidden
              />
              <span className="font-mono text-[10px] tabular-nums text-[var(--color-ink-faint)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="display-italic text-[16px] text-[var(--color-ink)] link-underline">
                {s.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="font-mono text-xs text-[var(--color-stamp)]">{error}</p>
      ) : null}
    </div>
  );
}
