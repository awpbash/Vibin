// /archive — past vibes index. Editorial table-of-contents style.
// Pulls from listVibes() which dispatches to Postgres if DATABASE_URL
// is set, otherwise the local JSON sidecar.

import Link from "next/link";
import { listVibes } from "@/lib/persist";
import { hasDatabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const all = await listVibes(100);
  // Hide partially-baked entries — public archive only shows vibes that
  // have both generated music and video. Drafts (extracted but no
  // assets) stay invisible until they're fully rendered.
  const vibes = all.filter(
    (v) =>
      Boolean(v.generatedAssets?.musicUrl) &&
      Boolean(v.generatedAssets?.previewVideoUrl),
  );
  const usingDb = hasDatabase();

  return (
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-20">
      <div className="pt-6">
        <div className="border-t-2 border-[var(--color-ink)] flex items-center justify-between pt-2 pb-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
            field guide
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
            archive · {vibes.length} editions on file
          </span>
        </div>
        <header className="flex items-baseline justify-between border-b border-[var(--color-rule)] pb-4 md:pb-5">
          <Link
            href="/"
            className="display-italic text-[30px] md:text-[32px] tracking-tight"
          >
            viber<span className="text-[var(--color-stamp)]">.</span>
          </Link>
          <div className="flex items-baseline gap-4 md:gap-5 caption">
            <Link href="/" className="hover:text-[var(--color-stamp)] transition-colors">
              ← home
            </Link>
            <span>·</span>
            <Link href="/lab" className="link-underline hidden sm:inline">field lab</Link>
          </div>
        </header>
      </div>

      <section className="mt-10 md:mt-14">
        <p className="eyebrow mb-4">past editions</p>
        <h1 className="display-xl text-[12vw] md:text-[64px] leading-[0.95]">
          archive,
          <br />
          <span className="display-italic">every vibe we have read.</span>
        </h1>
        <p className="caption mt-6">
          {usingDb
            ? "stored in postgres · persists across deploys"
            : "stored locally · .viber/vibes.json · no database configured"}
        </p>
      </section>

      {vibes.length === 0 ? (
        <section className="mt-20 md:mt-24 border-t border-[var(--color-rule)] pt-8">
          <p className="display-italic text-[24px] md:text-[28px] text-[var(--color-ink-soft)] max-w-[40ch]">
            no vibes on file yet. extract one from the home page and it
            will appear here.
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="caption link-underline"
            >
              ↩ back to extraction
            </Link>
          </div>
        </section>
      ) : (
        <ol className="mt-12 md:mt-16 border-t border-[var(--color-rule)]">
          {vibes.map((v, i) => {
            const date = new Date(v.createdAt ?? Date.now());
            const dateStr = `${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}.${String(date.getFullYear()).slice(-2)}`;
            const palette = v.palette?.slice(0, 4) ?? [];
            const hasMusic = Boolean(v.generatedAssets?.musicUrl);
            const hasVideo = Boolean(v.generatedAssets?.previewVideoUrl);
            return (
              <li
                key={v.id}
                className="border-b border-[var(--color-rule)]"
              >
                <Link
                  href={`/v/${v.id}`}
                  className="grid grid-cols-12 gap-3 md:gap-6 py-6 md:py-7 items-baseline group hover:bg-[var(--color-paper-hi)] transition-colors px-2 -mx-2"
                >
                  <span className="col-span-1 font-mono text-[10px] tabular-nums tracking-[0.22em] text-[var(--color-ink-faint)]">
                    {String(i + 1).padStart(3, "0")}
                  </span>

                  <div className="col-span-12 md:col-span-6 -mt-1">
                    <h2 className="display-md text-[20px] md:text-[26px] leading-[1.25] text-[var(--color-ink)] group-hover:text-[var(--color-stamp)] transition-colors">
                      {v.title}
                    </h2>
                    {v.oneLiner ? (
                      <p className="display-italic text-[15px] md:text-[17px] text-[var(--color-ink-soft)] mt-1 line-clamp-2 max-w-[60ch]">
                        {v.oneLiner}
                      </p>
                    ) : null}
                  </div>

                  <div className="col-span-6 md:col-span-2 flex flex-wrap gap-1 items-center">
                    {palette.map((c) => (
                      <span
                        key={c.hex}
                        className="block w-5 h-5 border border-[rgba(28,24,20,0.12)]"
                        style={{ background: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>

                  <div className="col-span-3 md:col-span-2 caption text-right md:text-left">
                    <span className="block">{v.timeOfDay?.replace(/-/g, " ")}</span>
                    <span className="block text-[var(--color-ink-faint)] tabular-nums">
                      {dateStr}
                    </span>
                  </div>

                  <div className="col-span-3 md:col-span-1 flex flex-col items-end gap-0.5">
                    {hasMusic ? (
                      <span
                        className="font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5"
                        style={{
                          background: "var(--color-ink)",
                          color: "var(--color-paper-hi)",
                        }}
                      >
                        ♪
                      </span>
                    ) : null}
                    {hasVideo ? (
                      <span
                        className="font-mono text-[9px] tracking-[0.22em] uppercase px-1.5 py-0.5"
                        style={{
                          background: "var(--color-stamp)",
                          color: "var(--color-paper-hi)",
                        }}
                      >
                        ▶
                      </span>
                    ) : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
