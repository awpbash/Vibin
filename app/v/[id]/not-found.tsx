import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen px-8 md:px-14 lg:px-24 py-14 flex flex-col">
      <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
        <Link href="/" className="display-italic text-[28px] tracking-tight">
          viber<span className="text-[var(--color-accent)]">.</span>
        </Link>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-ink-mute)]">
          issue not found
        </span>
      </header>

      <section className="my-auto max-w-[64rem]">
        <p className="eyebrow mb-5">404</p>
        <h1 className="display-xl text-[12vw] md:text-[7vw] leading-[0.95]">
          That issue
          <br />
          <span className="display-italic">never went to print.</span>
        </h1>
        <p className="mt-8 display-italic text-[20px] text-[var(--color-ink-soft)] max-w-[44ch]">
          The vibe you are looking for was not in our archives. Try pasting
          a YouTube link from the home page and we will sense a fresh one.
        </p>
        <Link
          href="/"
          className="inline-block mt-10 font-mono text-[11px] uppercase tracking-[0.22em] link-underline"
        >
          back to home
        </Link>
      </section>
    </main>
  );
}
