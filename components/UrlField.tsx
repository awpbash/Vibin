"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

const SAMPLES: Array<{ label: string; url: string }> = [
  { label: "tokyo coffee shop", url: "https://www.youtube.com/watch?v=dx9aDku80kM" },
  { label: "lisbon jazz bar",   url: "https://www.youtube.com/watch?v=lLxK5fEzaAU" },
  { label: "midnight hawker",   url: "https://www.youtube.com/watch?v=pBKlFnh96Tg" },
];

export function UrlField() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function submit(value: string) {
    if (!value.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: value }),
        });
        if (!res.ok) throw new Error(await res.text());
        const { vibeId } = (await res.json()) as { vibeId: string };
        router.push(`/v/${vibeId}`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "something went wrong");
      }
    });
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(url);
        }}
        className="flex items-baseline gap-4 border-b border-[var(--color-rule)] pb-4"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)] pt-3">
          url /
        </span>
        <input
          autoFocus
          spellCheck={false}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="paste a youtube link"
          className="field-input"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink)] hover:text-[var(--color-accent)] transition-colors pt-3 disabled:opacity-40"
        >
          {pending ? "sensing..." : "extract →"}
        </button>
      </form>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)]">
          try one /
        </span>
        {SAMPLES.map((s, i) => (
          <button
            key={s.url}
            onClick={() => {
              setUrl(s.url);
              submit(s.url);
            }}
            disabled={pending}
            className="group inline-flex items-baseline gap-2 disabled:opacity-40"
          >
            <span className="font-mono text-[10px] tabular-nums text-[var(--color-ink-faint)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="display-italic text-[19px] text-[var(--color-ink)] link-underline">
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {error ? (
        <p className="font-mono text-xs text-[var(--color-accent)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
