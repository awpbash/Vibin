"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Status = "idle" | "running" | "done" | "error";
type StepResult<T = unknown> = {
  status: Status;
  durationMs?: number;
  request?: { method: string; url: string; headers?: Record<string, string>; body?: unknown };
  response?: T;
  error?: string;
};

const SAMPLES = [
  { label: "tokyo coffee shop", url: "https://www.youtube.com/watch?v=dx9aDku80kM" },
  { label: "lisbon jazz bar",   url: "https://www.youtube.com/watch?v=lLxK5fEzaAU" },
  { label: "midnight hawker",   url: "https://www.youtube.com/watch?v=pBKlFnh96Tg" },
];

export default function WizardPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(SAMPLES[0].url);
  const [running, setRunning] = useState(false);
  const [vibeId, setVibeId] = useState<string | null>(null);
  const [extract, setExtract] = useState<StepResult>({ status: "idle" });
  const [vibe, setVibe] = useState<StepResult>({ status: "idle" });
  const [search, setSearch] = useState<StepResult>({ status: "idle" });
  const [generate, setGenerate] = useState<StepResult>({ status: "idle" });

  function reset() {
    setVibeId(null);
    setExtract({ status: "idle" });
    setVibe({ status: "idle" });
    setSearch({ status: "idle" });
    setGenerate({ status: "idle" });
  }

  async function runFromUrl(u: string) {
    reset();
    setRunning(true);
    try {
      const id = await stepExtractUrl(u, setExtract);
      if (id) {
        setVibeId(id);
        await stepVibe(id, setVibe);
        await stepSearch(id, setSearch);
        await stepGenerate(id, setGenerate);
      }
    } finally {
      setRunning(false);
    }
  }

  async function runFromFile(file: File) {
    reset();
    setRunning(true);
    try {
      const id = await stepExtractFile(file, setExtract);
      if (id) {
        setVibeId(id);
        await stepVibe(id, setVibe);
        await stepSearch(id, setSearch);
        await stepGenerate(id, setGenerate);
      }
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen px-6 md:px-14 lg:px-20 pb-20">
      <header className="pt-10 flex items-baseline justify-between border-b border-[var(--color-rule)] pb-5">
        <Link href="/" className="display-italic text-[32px] tracking-tight">
          viber<span className="text-[var(--color-stamp)]">.</span>
          <span className="ml-2 caption normal-case tracking-[0.18em]">/ field lab</span>
        </Link>
        <div className="flex items-baseline gap-5 caption">
          <span>step through the pipeline</span>
          <span>·</span>
          <Link href="/" className="link-underline">back</Link>
        </div>
      </header>

      <section className="mt-10 grid grid-cols-12 gap-10">
        <div className="col-span-12 lg:col-span-7">
          <p className="eyebrow mb-4">control panel</p>
          <h1 className="display-xl text-[8vw] md:text-[5vw] lg:text-[64px] mb-8">
            pipeline,
            <br />
            <span className="display-italic">in the open.</span>
          </h1>
          <p className="text-[16px] leading-[1.55] text-[var(--color-ink-soft)] max-w-[60ch] mb-8">
            Submit a clip or a URL. Watch each call go out and come back. Every
            step shows the request, the response, and a curl command you can
            paste straight into a terminal.
          </p>

          <div className="space-y-5">
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runFromFile(f);
              }}
            />
            <div className="flex flex-wrap gap-3">
              <button
                disabled={running}
                onClick={() => fileRef.current?.click()}
                className="px-5 py-2.5 bg-[var(--color-ink)] text-[var(--color-paper-hi)] caption hover:bg-[var(--color-stamp)] transition-colors disabled:opacity-40"
              >
                upload a clip
              </button>
              <button
                disabled={running}
                onClick={() => runFromUrl(url)}
                className="px-5 py-2.5 border border-[var(--color-rule)] caption hover:bg-[var(--color-stamp)] hover:text-[var(--color-paper-hi)] hover:border-[var(--color-stamp)] transition-colors disabled:opacity-40"
              >
                run with url
              </button>
              <button
                disabled={running}
                onClick={reset}
                className="px-5 py-2.5 caption text-[var(--color-ink-mute)] hover:text-[var(--color-stamp)] transition-colors disabled:opacity-40"
              >
                reset
              </button>
            </div>

            <input
              spellCheck={false}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={running}
              className="field-input border-b border-[var(--color-rule)] pb-2"
              style={{ fontSize: 18 }}
            />

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <span className="caption pt-1">samples</span>
              {SAMPLES.map((s, i) => (
                <button
                  key={s.url}
                  disabled={running}
                  onClick={() => {
                    setUrl(s.url);
                    runFromUrl(s.url);
                  }}
                  className="display-italic text-[16px] link-underline disabled:opacity-40"
                >
                  {String(i + 1).padStart(2, "0")} / {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-5">
          <p className="eyebrow mb-4">routes</p>
          <div className="space-y-3">
            <RouteRow method="POST" path="/api/extract"      blurb="multipart video OR { url } -> { vibeId }" />
            <RouteRow method="GET"  path="/api/vibe/[id]"    blurb="full vibe object + matched places" />
            <RouteRow method="GET"  path="/api/search"       blurb="?vibeId=X -> places ranked by feeling" />
            <RouteRow method="POST" path="/api/generate"     blurb="{ vibeId } -> { previewVideoUrl }" />
          </div>
          <p className="caption mt-6 max-w-[44ch]">
            real pipeline: yt-dlp, ffmpeg, gpt-5.5 vision, gpt image 2,
            text-embedding-3-large, google maps places (new), fal veo 3 fast.
          </p>
        </aside>
      </section>

      <section className="mt-16 space-y-6">
        <Step
          n="01"
          title="extract"
          description="downloads the video, samples 8 frames, runs gpt-5.5 vision with structured output, embeds the result"
          result={extract}
        />
        <Step
          n="02"
          title="vibe"
          description="reads the persisted vibe object back from disk + in-memory store"
          result={vibe}
        />
        <Step
          n="03"
          title="search"
          description="cosine ranks pre-baselined cafes near the venue, returns top three with why-this-matches"
          result={search}
        />
        <Step
          n="04"
          title="generate"
          description="gpt image 2 stills + fal veo fast hero clip + ffmpeg stitch into a 60s mp4 in /generated"
          result={generate}
        />
      </section>

      {vibeId && !running ? (
        <section className="mt-16 border-t border-[var(--color-rule)] pt-10 flex items-baseline justify-between">
          <div>
            <p className="caption mb-2">complete</p>
            <h2 className="display-lg text-[44px]">
              <span className="display-italic">vibe.id</span> = <span className="font-mono text-[24px]">{vibeId}</span>
            </h2>
          </div>
          <div className="flex items-baseline gap-6">
            <Link href={`/v/${vibeId}`} className="display-italic text-[26px] link-underline">
              open vibe page
            </Link>
            <Link href={`/v/${vibeId}/play`} className="display-italic text-[26px] link-underline">
              play it
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  );
}

// ---------- components ----------

function RouteRow({
  method,
  path,
  blurb,
}: {
  method: string;
  path: string;
  blurb: string;
}) {
  return (
    <div className="flex items-baseline gap-3 border-t border-dotted border-[var(--color-rule-soft)] pt-3">
      <span
        className="font-mono text-[10px] tracking-[0.22em] px-1.5 py-0.5"
        style={{
          background: method === "POST" ? "var(--color-stamp)" : "var(--color-ink)",
          color: "var(--color-paper-hi)",
        }}
      >
        {method}
      </span>
      <code className="font-mono text-[13px] text-[var(--color-ink)]">{path}</code>
      <span className="caption flex-1 text-right">{blurb}</span>
    </div>
  );
}

function Step({
  n,
  title,
  description,
  result,
}: {
  n: string;
  title: string;
  description: string;
  result: StepResult;
}) {
  return (
    <article className="border border-[var(--color-rule)] bg-[var(--color-paper-hi)]" style={{ boxShadow: "var(--shadow-card)" }}>
      <header className="px-5 md:px-7 py-4 flex items-baseline justify-between border-b border-[var(--color-rule)] gap-4">
        <div className="flex items-baseline gap-4 min-w-0">
          <span className="font-mono text-[10px] tabular-nums tracking-[0.22em] text-[var(--color-ink-faint)]">
            {n}.
          </span>
          <h3 className="display-md text-[24px] text-[var(--color-ink)]">{title}</h3>
          <span className="caption hidden md:inline truncate">{description}</span>
        </div>
        <StatusBadge status={result.status} ms={result.durationMs} />
      </header>

      {result.request ? (
        <div className="px-5 md:px-7 py-4 border-b border-dotted border-[var(--color-rule-soft)]">
          <p className="caption mb-2">request</p>
          <div className="flex items-baseline gap-3 flex-wrap">
            <span
              className="font-mono text-[10px] tracking-[0.22em] px-1.5 py-0.5"
              style={{
                background:
                  result.request.method === "POST"
                    ? "var(--color-stamp)"
                    : "var(--color-ink)",
                color: "var(--color-paper-hi)",
              }}
            >
              {result.request.method}
            </span>
            <code className="font-mono text-[13px] text-[var(--color-ink)]">
              {result.request.url}
            </code>
          </div>
          {result.request.body !== undefined ? (
            <Pre label="body" value={result.request.body} />
          ) : null}
          <Pre label="curl" value={curlOf(result.request)} mono />
        </div>
      ) : null}

      {result.response !== undefined ? (
        <div className="px-5 md:px-7 py-4">
          <p className="caption mb-2">response</p>
          <Pre value={result.response} />
        </div>
      ) : null}

      {result.error ? (
        <div className="px-5 md:px-7 py-4 border-t border-dotted border-[var(--color-rule-soft)]">
          <p className="caption mb-2 text-[var(--color-stamp)]">error</p>
          <pre className="font-mono text-[12px] text-[var(--color-stamp-ink)] whitespace-pre-wrap">{result.error}</pre>
        </div>
      ) : null}
    </article>
  );
}

function StatusBadge({ status, ms }: { status: Status; ms?: number }) {
  if (status === "idle")
    return <span className="caption text-[var(--color-ink-faint)]">pending</span>;
  if (status === "running")
    return <span className="caption text-[var(--color-stamp)]">running...</span>;
  if (status === "error")
    return <span className="caption text-[var(--color-stamp)]">error</span>;
  return (
    <span className="caption text-[var(--color-ink)] tabular-nums">
      done {ms ? `· ${ms} ms` : ""}
    </span>
  );
}

function Pre({
  label,
  value,
  mono,
}: {
  label?: string;
  value: unknown;
  mono?: boolean;
}) {
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return (
    <div className="mt-3">
      {label ? <p className="caption mb-1">{label}</p> : null}
      <pre
        className={`font-mono text-[12px] leading-[1.6] text-[var(--color-ink)] bg-[var(--color-paper)] px-3 py-3 max-h-[420px] overflow-auto ${
          mono ? "" : ""
        }`}
        style={{ border: "1px solid var(--color-rule-soft)" }}
      >
        {text}
      </pre>
    </div>
  );
}

function curlOf(req: { method: string; url: string; body?: unknown }) {
  const parts = [`curl -X ${req.method}`];
  parts.push(`'http://localhost:3000${req.url}'`);
  if (req.body !== undefined && req.body !== null) {
    if (req.body instanceof FormData || (typeof req.body === "object" && Array.isArray((req.body as { __isMultipart?: boolean }).__isMultipart))) {
      parts.push(`-F 'video=@your-clip.mp4'`);
    } else {
      parts.push(`-H 'Content-Type: application/json'`);
      parts.push(`-d '${JSON.stringify(req.body)}'`);
    }
  }
  return parts.join(" \\\n  ");
}

// ---------- step runners ----------

async function stepExtractUrl(
  url: string,
  set: (r: StepResult) => void,
): Promise<string | null> {
  set({
    status: "running",
    request: {
      method: "POST",
      url: "/api/extract",
      headers: { "Content-Type": "application/json" },
      body: { url },
    },
  });
  const t0 = performance.now();
  try {
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const dur = Math.round(performance.now() - t0);
    if (!res.ok) {
      set({
        status: "error",
        durationMs: dur,
        request: {
          method: "POST",
          url: "/api/extract",
          headers: { "Content-Type": "application/json" },
          body: { url },
        },
        error: await res.text(),
      });
      return null;
    }
    const data = await res.json();
    set({
      status: "done",
      durationMs: dur,
      request: {
        method: "POST",
        url: "/api/extract",
        headers: { "Content-Type": "application/json" },
        body: { url },
      },
      response: data,
    });
    return data.vibeId;
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

async function stepExtractFile(
  file: File,
  set: (r: StepResult) => void,
): Promise<string | null> {
  set({
    status: "running",
    request: {
      method: "POST",
      url: "/api/extract",
      headers: { "Content-Type": "multipart/form-data" },
      body: { __isMultipart: true, file: file.name, size: file.size },
    },
  });
  const t0 = performance.now();
  try {
    const fd = new FormData();
    fd.append("video", file);
    const res = await fetch("/api/extract", { method: "POST", body: fd });
    const dur = Math.round(performance.now() - t0);
    if (!res.ok) {
      set({ status: "error", durationMs: dur, error: await res.text() });
      return null;
    }
    const data = await res.json();
    set({
      status: "done",
      durationMs: dur,
      request: {
        method: "POST",
        url: "/api/extract",
        headers: { "Content-Type": "multipart/form-data" },
        body: { __isMultipart: true, file: file.name, size: file.size },
      },
      response: data,
    });
    return data.vibeId;
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

async function stepVibe(id: string, set: (r: StepResult) => void) {
  set({
    status: "running",
    request: { method: "GET", url: `/api/vibe/${id}` },
  });
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/vibe/${id}`);
    const dur = Math.round(performance.now() - t0);
    if (!res.ok) {
      set({
        status: "error",
        durationMs: dur,
        request: { method: "GET", url: `/api/vibe/${id}` },
        error: await res.text(),
      });
      return;
    }
    const data = await res.json();
    set({
      status: "done",
      durationMs: dur,
      request: { method: "GET", url: `/api/vibe/${id}` },
      response: data,
    });
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

async function stepSearch(id: string, set: (r: StepResult) => void) {
  set({
    status: "running",
    request: { method: "GET", url: `/api/search?vibeId=${id}` },
  });
  const t0 = performance.now();
  try {
    const res = await fetch(`/api/search?vibeId=${id}`);
    const dur = Math.round(performance.now() - t0);
    if (!res.ok) {
      set({
        status: "error",
        durationMs: dur,
        request: { method: "GET", url: `/api/search?vibeId=${id}` },
        error: await res.text(),
      });
      return;
    }
    const data = await res.json();
    set({
      status: "done",
      durationMs: dur,
      request: { method: "GET", url: `/api/search?vibeId=${id}` },
      response: data,
    });
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}

async function stepGenerate(id: string, set: (r: StepResult) => void) {
  set({
    status: "running",
    request: {
      method: "POST",
      url: "/api/generate",
      headers: { "Content-Type": "application/json" },
      body: { vibeId: id },
    },
  });
  const t0 = performance.now();
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vibeId: id }),
    });
    const dur = Math.round(performance.now() - t0);
    if (!res.ok) {
      set({
        status: "error",
        durationMs: dur,
        request: {
          method: "POST",
          url: "/api/generate",
          headers: { "Content-Type": "application/json" },
          body: { vibeId: id },
        },
        error: await res.text(),
      });
      return;
    }
    const data = await res.json();
    set({
      status: "done",
      durationMs: dur,
      request: {
        method: "POST",
        url: "/api/generate",
        headers: { "Content-Type": "application/json" },
        body: { vibeId: id },
      },
      response: data,
    });
  } catch (e) {
    set({ status: "error", error: e instanceof Error ? e.message : String(e) });
  }
}
