"use client";

// Next.js requires an error.tsx adjacent to the root segment so runtime
// errors during rendering have an explicit boundary. Without this, dev
// shows "missing required error components, refreshing..." and prod
// crashes the whole page.

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[viber error boundary]", error);
  }, [error]);

  return (
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-20">
      <div className="pt-6">
        <div className="border-t-2 border-[var(--color-ink)] flex items-center justify-between pt-2 pb-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
            field guide
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-stamp)]">
            something snapped
          </span>
        </div>
      </div>

      <section className="mt-20 md:mt-28 max-w-[60ch]">
        <p className="eyebrow mb-3">edition pulled from press</p>
        <h1 className="display-xl text-[12vw] md:text-[88px] leading-[0.95]">
          a page,
          <br />
          <span className="display-italic">misprinted.</span>
        </h1>
        <p className="display-italic text-[20px] md:text-[24px] mt-8 text-[var(--color-ink-soft)]">
          {error.message || "the press jammed somewhere upstream."}
        </p>
        {error.digest ? (
          <p className="caption mt-3">trace · {error.digest}</p>
        ) : null}

        <div className="mt-10 flex flex-wrap items-baseline gap-5">
          <button onClick={reset} className="caption-btn">
            try again
          </button>
          <Link href="/" className="caption link-underline">
            ← home
          </Link>
        </div>
      </section>
    </main>
  );
}
