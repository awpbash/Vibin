"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

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

      <HealthBanner />

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

      <Suspense fallback={null}>
        <DevOnly>
          <TestBench />
        </DevOnly>
      </Suspense>

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

// ---------- Health banner ----------

type Health = {
  flags: Record<string, string>;
  keys: Record<string, boolean>;
  models: Record<string, string>;
  tools: Record<string, boolean>;
  venue: { lat: number; lng: number; radiusM: number };
};

function HealthBanner() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setH)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) {
    return (
      <div className="mt-5 px-4 py-3 border border-[var(--color-stamp)] caption text-[var(--color-stamp)]">
        health endpoint failed: {err}
      </div>
    );
  }
  if (!h) {
    return <div className="mt-5 caption">checking environment...</div>;
  }

  return (
    <section
      className="mt-5 grid grid-cols-12 gap-3 px-4 py-3 border border-[var(--color-rule)]"
      style={{ background: "var(--color-paper-hi)" }}
    >
      <div className="col-span-12 md:col-span-3 flex items-baseline gap-3">
        <span className="caption">pipeline</span>
        <span
          className="font-mono text-[11px] uppercase tracking-[0.18em] px-1.5 py-0.5"
          style={{
            background: "var(--color-stamp)",
            color: "var(--color-paper-hi)",
          }}
        >
          live
        </span>
        <span className="caption normal-case tracking-normal text-[var(--color-ink-faint)]">
          calls real apis
        </span>
      </div>

      <div className="col-span-12 md:col-span-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="caption">keys</span>
        {Object.entries(h.keys).map(([k, ok]) => (
          <KeyChip key={k} label={k} ok={ok} />
        ))}
      </div>

      <div className="col-span-12 md:col-span-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 md:justify-end">
        <span className="caption">tools</span>
        {Object.entries(h.tools).map(([k, ok]) => (
          <KeyChip key={k} label={k} ok={ok} />
        ))}
      </div>

      <div className="col-span-12 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="caption">models</span>
        {Object.entries(h.models).map(([k, v]) => (
          <span key={k} className="caption normal-case tracking-normal">
            <span className="text-[var(--color-ink-faint)]">{k}=</span>
            <code className="font-mono text-[var(--color-ink)]">{v}</code>
          </span>
        ))}
      </div>
    </section>
  );
}

function KeyChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className="font-mono text-[10px] tracking-[0.14em] uppercase px-1.5 py-0.5"
      style={{
        background: ok ? "var(--color-ink)" : "transparent",
        color: ok ? "var(--color-paper-hi)" : "var(--color-ink-faint)",
        border: ok ? "none" : "1px dashed var(--color-ink-faint)",
      }}
      title={ok ? `${label} key set` : `${label} key missing`}
    >
      {ok ? "✓" : "·"} {label}
    </span>
  );
}

// ---------- Dev-only gate ----------

// The Test Bench shows when ?dev=1 is in the URL. Public access to /lab
// shows the routes panel + pipeline stepper but hides the per-API test
// cards. This keeps the lab usable as a "what we did" tour without
// looking like an unfinished workshop during a demo.
function DevOnly({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  if (params?.get("dev") !== "1") return null;
  return <>{children}</>;
}

// ---------- Test Bench ----------

type TestState = {
  status: Status;
  ms?: number;
  data?: Record<string, unknown> | null;
  error?: string | null;
  audioUrl?: string;
};

function TestBench() {
  const [openai, setOpenai] = useState<TestState>({ status: "idle" });
  const [gemini, setGemini] = useState<TestState>({ status: "idle" });
  const [music, setMusic] = useState<TestState>({ status: "idle" });
  const [tts, setTts] = useState<TestState>({ status: "idle" });

  const [musicPreset, setMusicPreset] = useState<"tokyo" | "lisbon" | "hawker">("tokyo");
  const [geminiPreset, setGeminiPreset] = useState<"tokyo" | "lisbon" | "hawker">("tokyo");
  const [ttsVoice, setTtsVoice] = useState<"sarah" | "george" | "rachel" | "elli" | "adam">(
    "sarah",
  );

  async function runOpenAi() {
    setOpenai({ status: "running" });
    const t0 = performance.now();
    try {
      const res = await fetch("/api/test/openai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setOpenai({
        status: res.ok && json.ok ? "done" : "error",
        ms: Math.round(performance.now() - t0),
        data: json,
        error: json.error,
      });
    } catch (e) {
      setOpenai({
        status: "error",
        ms: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function runGemini() {
    setGemini({ status: "running" });
    const t0 = performance.now();
    try {
      const res = await fetch("/api/test/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: geminiPreset, durationSec: 30 }),
      });
      const json = await res.json();
      setGemini({
        status: res.ok && json.ok ? "done" : "error",
        ms: Math.round(performance.now() - t0),
        data: json,
        error: json.error,
      });
    } catch (e) {
      setGemini({
        status: "error",
        ms: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function runMusic() {
    setMusic({ status: "running" });
    const t0 = performance.now();
    try {
      const res = await fetch("/api/test/elevenlabs-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preset: musicPreset, lengthMs: 30000 }),
      });
      const json = await res.json();
      setMusic({
        status: res.ok && json.ok ? "done" : "error",
        ms: Math.round(performance.now() - t0),
        data: json,
        error: json.error,
        audioUrl: json.audioUrl,
      });
    } catch (e) {
      setMusic({
        status: "error",
        ms: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function runTts() {
    setTts({ status: "running" });
    const t0 = performance.now();
    try {
      const res = await fetch("/api/test/elevenlabs-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voicePreset: ttsVoice }),
      });
      const json = await res.json();
      setTts({
        status: res.ok && json.ok ? "done" : "error",
        ms: Math.round(performance.now() - t0),
        data: json,
        error: json.error,
        audioUrl: json.audioUrl,
      });
    } catch (e) {
      setTts({
        status: "error",
        ms: Math.round(performance.now() - t0),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <section className="mt-16">
      <div className="flex items-baseline justify-between mb-6">
        <div className="flex items-baseline gap-3">
          <span className="font-mono text-[10px] tabular-nums tracking-[0.22em] text-[var(--color-ink-faint)]">
            00.
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-ink-mute)]">
            test bench
          </span>
        </div>
        <span className="caption">verify your keys before running the pipeline</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <TestCard
          title="openai vision"
          subtitle={String(openai.data?.model ?? "gpt-5.4-mini")}
          endpoint="POST /api/test/openai"
          state={openai}
          actions={
            <button
              onClick={runOpenAi}
              disabled={openai.status === "running"}
              className="caption-btn"
            >
              {openai.status === "running" ? "calling..." : "run sample"}
            </button>
          }
        >
          {openai.data?.response ? (
            <p className="display-italic text-[18px] leading-[1.5] text-[var(--color-ink)] mt-3">
              {String(openai.data.response)}
            </p>
          ) : null}
          {openai.data?.cost ? (
            <CostFooter usage={openai.data.usage as Record<string, unknown>} cost={openai.data.cost as Record<string, number>} />
          ) : null}
        </TestCard>

        <TestCard
          title="gemini audio"
          subtitle="gemini-2.5-flash"
          endpoint="POST /api/test/gemini"
          state={gemini}
          actions={
            <div className="flex items-baseline gap-3 flex-wrap">
              {(["tokyo", "lisbon", "hawker"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setGeminiPreset(p)}
                  disabled={gemini.status === "running"}
                  className={`caption ${
                    geminiPreset === p
                      ? "text-[var(--color-stamp)]"
                      : "text-[var(--color-ink-mute)]"
                  } hover:text-[var(--color-stamp)] disabled:opacity-40`}
                >
                  {p}
                </button>
              ))}
              <span className="ml-auto" />
              <button
                onClick={runGemini}
                disabled={gemini.status === "running"}
                className="caption-btn"
              >
                {gemini.status === "running" ? "listening..." : "analyze 30s"}
              </button>
            </div>
          }
        >
          <GeminiAudioReadout data={gemini.data} />
        </TestCard>

        <TestCard
          title="elevenlabs music"
          subtitle="eleven-music"
          endpoint="POST /api/test/elevenlabs-music"
          state={music}
          actions={
            <div className="flex items-baseline gap-3 flex-wrap">
              {(["tokyo", "lisbon", "hawker"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setMusicPreset(p)}
                  disabled={music.status === "running"}
                  className={`caption ${
                    musicPreset === p
                      ? "text-[var(--color-stamp)]"
                      : "text-[var(--color-ink-mute)]"
                  } hover:text-[var(--color-stamp)] disabled:opacity-40`}
                >
                  {p}
                </button>
              ))}
              <span className="ml-auto" />
              <button
                onClick={runMusic}
                disabled={music.status === "running"}
                className="caption-btn"
              >
                {music.status === "running" ? "composing..." : "compose 30s"}
              </button>
            </div>
          }
        >
          {music.audioUrl ? (
            <div className="mt-4">
              <audio controls src={music.audioUrl} className="w-full" />
              <p className="caption mt-2">{music.audioUrl}</p>
            </div>
          ) : null}
        </TestCard>

        <TestCard
          title="elevenlabs tts"
          subtitle={
            (process.env.NEXT_PUBLIC_ELEVENLABS_MODEL_ID as string) ||
            "eleven_multilingual_v2"
          }
          endpoint="POST /api/test/elevenlabs-tts"
          state={tts}
          actions={
            <div className="flex items-baseline gap-3 flex-wrap">
              {(["sarah", "george", "rachel", "elli", "adam"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setTtsVoice(v)}
                  disabled={tts.status === "running"}
                  className={`caption ${
                    ttsVoice === v
                      ? "text-[var(--color-stamp)]"
                      : "text-[var(--color-ink-mute)]"
                  } hover:text-[var(--color-stamp)] disabled:opacity-40`}
                >
                  {v}
                </button>
              ))}
              <span className="ml-auto" />
              <button
                onClick={runTts}
                disabled={tts.status === "running"}
                className="caption-btn"
              >
                {tts.status === "running" ? "speaking..." : "speak sample"}
              </button>
            </div>
          }
        >
          {tts.audioUrl ? (
            <div className="mt-4">
              <audio controls src={tts.audioUrl} className="w-full" />
              <p className="caption mt-2">{tts.audioUrl}</p>
            </div>
          ) : null}
        </TestCard>
      </div>
    </section>
  );
}

function CostFooter({
  usage,
  cost,
}: {
  usage: Record<string, unknown>;
  cost: Record<string, number>;
}) {
  const fmt = (n: number) =>
    n === 0
      ? "$0"
      : n < 0.01
      ? `$${n.toFixed(4)}`
      : n < 1
      ? `$${n.toFixed(3)}`
      : `$${n.toFixed(2)}`;
  return (
    <div className="mt-4 grid grid-cols-12 gap-x-3 gap-y-1 caption text-[var(--color-ink-mute)] border-t border-dotted border-[var(--color-rule-soft)] pt-3">
      <div className="col-span-6">
        <span className="tracking-[0.18em]">tokens</span>
        <span className="ml-2 font-mono normal-case tracking-normal text-[var(--color-ink)]">
          {String(usage.prompt_tokens ?? 0)} in
        </span>
        <span className="ml-2 font-mono normal-case tracking-normal text-[var(--color-ink)]">
          / {String(usage.completion_tokens ?? 0)} out
        </span>
      </div>
      <div className="col-span-6 text-right">
        <span className="tracking-[0.18em]">cost</span>
        <span className="ml-2 font-mono normal-case tracking-normal text-[var(--color-stamp)]">
          {fmt(cost.usdTotal ?? 0)}
        </span>
      </div>
    </div>
  );
}

function GeminiAudioReadout({ data }: { data?: Record<string, unknown> | null }) {
  if (!data) return null;
  const a = data.analysis as
    | {
        hasMusic?: boolean;
        genre?: string;
        tempoBpm?: number;
        key?: string;
        instruments?: string[];
        ambientLayers?: string[];
        audioMood?: string[];
        musicalCharacter?: string;
      }
    | undefined;
  const stages = (data.stages as Array<{ name: string; ms: number }>) ?? [];
  const cost = (data.estCostUsd as number) ?? 0;
  if (!a) return null;

  const fmtCost = (n: number) =>
    n === 0 ? "$0" : n < 0.01 ? `$${n.toFixed(5)}` : `$${n.toFixed(3)}`;

  return (
    <div className="mt-4 space-y-3">
      <p className="display-italic text-[18px] leading-[1.45]">
        {a.musicalCharacter ?? "—"}
      </p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 caption text-[var(--color-ink-mute)]">
        <dt className="tracking-[0.18em]">music</dt>
        <dd className="font-mono normal-case tracking-normal text-[var(--color-ink)]">
          {a.hasMusic ? "yes" : "no"}
        </dd>
        <dt className="tracking-[0.18em]">genre</dt>
        <dd className="font-mono normal-case tracking-normal text-[var(--color-ink)]">
          {a.genre ?? "—"}
        </dd>
        <dt className="tracking-[0.18em]">tempo</dt>
        <dd className="font-mono normal-case tracking-normal text-[var(--color-ink)]">
          {a.tempoBpm ? `${a.tempoBpm} bpm` : "—"}
        </dd>
        <dt className="tracking-[0.18em]">key</dt>
        <dd className="font-mono normal-case tracking-normal text-[var(--color-ink)]">
          {a.key ?? "—"}
        </dd>
      </dl>

      {a.instruments?.length ? (
        <p className="caption">
          <span className="tracking-[0.18em]">instruments</span>{" "}
          <span className="normal-case tracking-normal text-[var(--color-ink)]">
            {a.instruments.join(", ")}
          </span>
        </p>
      ) : null}

      {a.ambientLayers?.length ? (
        <p className="caption">
          <span className="tracking-[0.18em]">ambient</span>{" "}
          <span className="normal-case tracking-normal text-[var(--color-ink)]">
            {a.ambientLayers.join(", ")}
          </span>
        </p>
      ) : null}

      {a.audioMood?.length ? (
        <p className="caption">
          <span className="tracking-[0.18em]">mood</span>{" "}
          <span className="normal-case tracking-normal text-[var(--color-ink)]">
            {a.audioMood.join(", ")}
          </span>
        </p>
      ) : null}

      <div className="border-t border-dotted border-[var(--color-rule-soft)] pt-3 grid grid-cols-12 gap-x-3 caption text-[var(--color-ink-mute)]">
        <div className="col-span-7 flex flex-wrap gap-x-3">
          {stages.map((s) => (
            <span key={s.name} className="font-mono normal-case tracking-normal">
              <span className="text-[var(--color-ink-faint)]">{s.name}</span>{" "}
              <span className="text-[var(--color-ink)]">{s.ms}ms</span>
            </span>
          ))}
        </div>
        <div className="col-span-5 text-right">
          <span className="tracking-[0.18em]">cost</span>{" "}
          <span className="font-mono normal-case tracking-normal text-[var(--color-stamp)]">
            {fmtCost(cost)}
          </span>
        </div>
      </div>
    </div>
  );
}

function TestCard({
  title,
  subtitle,
  endpoint,
  state,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  endpoint: string;
  state: TestState;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <article
      className="border border-[var(--color-rule)] bg-[var(--color-paper-hi)] p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <header className="flex items-baseline justify-between gap-3 mb-2">
        <h3 className="display-md text-[22px]">{title}</h3>
        <StatusBadge status={state.status} ms={state.ms} />
      </header>
      <p className="caption mb-4">
        <code className="font-mono">{endpoint}</code>
        <span className="ml-3 text-[var(--color-ink-faint)] normal-case tracking-normal">
          {subtitle}
        </span>
      </p>

      <div className="space-y-3">{actions}</div>

      {state.error ? (
        <pre className="mt-3 font-mono text-[12px] text-[var(--color-stamp-ink)] whitespace-pre-wrap">
          {state.error}
        </pre>
      ) : null}

      {children}
    </article>
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
