// Real extraction pipeline. yt-dlp -> ffmpeg frames -> OpenAI vision ->
// VibeObject -> embedding -> persisted.
//
// Falls back to a fixture when USE_MOCK_PIPELINE !== "false".

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { VIBE_EXTRACTION_PROMPT, VIBE_OBJECT_SCHEMA } from "./vibe-prompt";
import { analyzeAudio } from "./audio-analysis";
import { saveAsset } from "./storage";
import type { AudioAnalysis, VibeObject } from "./types";

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";
// Sample at FRAME_FPS frames per second of source video, capped at
// FRAME_MAX_COUNT frames total so a long clip doesn't blow up vision
// token cost. A 30s clip at 1 fps = 30 frames, a 5min clip caps at
// the max. Override either via env if needed.
const FRAME_FPS = parseFloat(process.env.VIBER_FRAME_FPS ?? "1");
const FRAME_MAX_COUNT = parseInt(
  process.env.VIBER_FRAME_MAX_COUNT ??
    process.env.VIBER_FRAME_COUNT ??
    "24",
  10,
);
const FRAME_WIDTH = parseInt(process.env.VIBER_FRAME_WIDTH ?? "768", 10);

// Fallback chain: try cheaper models first if the configured one isn't
// available. Keeps the demo running even if the coupon doesn't unlock 5.5.
const VISION_FALLBACKS = [
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-4o-mini",
  "gpt-4o",
];

type ExtractInput =
  | { kind: "youtube"; url: string }
  | {
      kind: "upload";
      videoPath: string;
      originalName?: string;
      previewUrl?: string;       // public web url to play the clip back
      contentType?: string;
    };

export async function extractFromYouTube(url: string): Promise<VibeObject> {
  return extract({ kind: "youtube", url });
}

export async function extractFromUpload(opts: {
  videoPath: string;
  originalName?: string;
  previewUrl?: string;
  contentType?: string;
}): Promise<VibeObject> {
  return extract({
    kind: "upload",
    videoPath: opts.videoPath,
    originalName: opts.originalName,
    previewUrl: opts.previewUrl,
    contentType: opts.contentType,
  });
}

async function extract(input: ExtractInput): Promise<VibeObject> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const id = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const tmp = path.join(process.cwd(), ".viber", "tmp", id);
  await fs.mkdir(tmp, { recursive: true });

  try {
    let videoPath: string;
    if (input.kind === "youtube") {
      videoPath = path.join(tmp, "v.mp4");
      await ytDlp(input.url, videoPath);
    } else {
      videoPath = input.videoPath;
    }

    const duration = await ffprobeDuration(videoPath);

    // Frame count = duration × fps, capped. 1 fps default with a 24-
    // frame ceiling means a 30s phone clip gets dense coverage and a
    // 5-minute YouTube doesn't blow up vision tokens.
    const targetFrameCount = Math.min(
      FRAME_MAX_COUNT,
      Math.max(1, Math.ceil(duration * FRAME_FPS)),
    );

    // Vision and audio in parallel — independent, both optional-failure.
    const [draft, audioResult] = await Promise.all([
      sampleFrames(videoPath, tmp, targetFrameCount, duration).then(callVision),
      runAudioAnalysis(videoPath, tmp, duration, id),
    ]);

    const audioAnalysis = audioResult?.analysis;

    // Audio overrides the vision-guessed musicAnchor when music is present,
    // and ambient room sounds get merged into the soundscape.
    if (audioAnalysis) {
      if (audioAnalysis.hasMusic) {
        draft.musicAnchor = {
          genre: audioAnalysis.genre || draft.musicAnchor.genre,
          tempoBpm: audioAnalysis.tempoBpm || draft.musicAnchor.tempoBpm,
          key: audioAnalysis.key || draft.musicAnchor.key,
          referenceTrack: draft.musicAnchor.referenceTrack,
        };
      }
      if (audioAnalysis.ambientLayers.length) {
        draft.soundscape = dedupeStrings([
          ...audioAnalysis.ambientLayers,
          ...draft.soundscape,
        ]).slice(0, 6);
      }
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    let embedding: number[] | undefined;
    try {
      const e = await client.embeddings.create({
        model: EMBED_MODEL,
        input: embedSource(draft),
      });
      embedding = e.data[0].embedding;
    } catch {
      // embedding is optional
    }

    const source: VibeObject["source"] =
      input.kind === "youtube"
        ? {
            kind: "youtube",
            url: input.url,
            previewUrl: youtubeEmbedUrl(input.url),
            audioSampleUrl: audioResult?.sampleUrl,
            durationSeconds: Math.round(duration),
          }
        : {
            kind: "capture",
            previewUrl: input.previewUrl,
            audioSampleUrl: audioResult?.sampleUrl,
            contentType: input.contentType,
            durationSeconds: Math.round(duration),
          };

    return {
      id,
      source,
      title: draft.title,
      oneLiner: draft.oneLiner,
      palette: draft.palette,
      lighting: draft.lighting,
      spatial: draft.spatial,
      visualMotifs: draft.visualMotifs,
      density: draft.density,
      energy: draft.energy,
      timeOfDay: draft.timeOfDay,
      weatherImplied: draft.weatherImplied,
      soundscape: draft.soundscape,
      musicAnchor: draft.musicAnchor,
      moodTags: draft.moodTags,
      embedding,
      audioAnalysis,
      createdAt: Date.now(),
    };
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ---------- Helpers ----------

function ytDlp(url: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-f",
      "best[height<=720][ext=mp4]/best[height<=720]/best",
      "--no-playlist",
      "--no-warnings",
      "-o",
      outPath,
      url,
    ];
    const p = spawn("yt-dlp", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`yt-dlp not installed or not on PATH: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`yt-dlp exit ${code}: ${err}`)),
    );
  });
}

function ffprobeDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffprobe not installed: ${e.message}`)),
    );
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}: ${err}`));
      const n = parseFloat(out.trim());
      if (!isFinite(n) || n <= 0) return resolve(60);
      resolve(n);
    });
  });
}

async function sampleFrames(
  videoPath: string,
  tmp: string,
  count: number,
  duration: number,
): Promise<string[]> {
  const frames: string[] = [];
  for (let i = 0; i < count; i++) {
    const t = Math.max(1, (duration * (i + 0.5)) / count);
    const out = path.join(tmp, `f${i}.jpg`);
    await ffmpegFrame(videoPath, t, out);
    const buf = await fs.readFile(out);
    frames.push(buf.toString("base64"));
  }
  return frames;
}

// Pulls a ~30s mono mp3 from the middle of the source video, persists
// it as the canonical playable artefact, AND extracts 3 × 10s slices
// (intro, mid, outro) for the gpt-4o-audio Self-Consistency pass.
// Slices give us 3 independent listens for tempo/key/instrument
// consensus rather than over-trusting one chunk. All failures are
// non-fatal — extraction continues with a vision-only vibe if audio
// analysis breaks.
async function runAudioAnalysis(
  videoPath: string,
  tmp: string,
  duration: number,
  vibeId: string,
): Promise<{ analysis: AudioAnalysis; sampleUrl: string } | undefined> {
  if (!process.env.OPENAI_API_KEY) return undefined;
  try {
    // 30s persisted sample, centered on the middle of the source.
    const sampleStart = Math.max(0, duration / 2 - 15);
    const sampleDur = Math.min(30, Math.max(4, duration));
    const tmpSample = path.join(tmp, "audio.mp3");
    await ffmpegAudio(videoPath, tmpSample, sampleStart, sampleDur);
    const sampleBuf = await fs.readFile(tmpSample);

    // Persist via storage abstraction — Vercel Blob if configured, else
    // /public/uploads/ on disk. Either way produces a public URL.
    const sampleName = `${vibeId}-source-sample.mp3`;
    const stored = await saveAsset("uploads", sampleName, sampleBuf, "audio/mpeg");

    // 3 × 10s slices spaced across the source. For very short sources
    // (under ~12s), all three slices collapse onto the same window —
    // Self-Consistency degrades but the call still works.
    const sliceLen = Math.min(10, Math.max(4, duration));
    const intro = Math.max(0, Math.min(0, duration - sliceLen));
    const mid = Math.max(0, duration / 2 - sliceLen / 2);
    const outro = Math.max(0, duration - sliceLen);

    const slicePaths = [
      { start: intro, label: `intro (0-${Math.round(sliceLen)}s)` },
      { start: mid, label: `mid (~${Math.round(mid)}s)` },
      { start: outro, label: `outro (last ${Math.round(sliceLen)}s)` },
    ];

    const slices: { buf: Buffer; mime: string; label: string }[] = [];
    for (let i = 0; i < slicePaths.length; i++) {
      const p = path.join(tmp, `slice-${i}.mp3`);
      await ffmpegAudio(videoPath, p, slicePaths[i].start, sliceLen);
      const buf = await fs.readFile(p);
      slices.push({ buf, mime: "audio/mp3", label: slicePaths[i].label });
    }

    const analysis = await analyzeAudio({ slices });
    return { analysis, sampleUrl: stored.url };
  } catch (e) {
    console.error("audio analysis failed:", e);
    return undefined;
  }
}

function ffmpegAudio(
  input: string,
  out: string,
  startSec: number,
  durSec: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(startSec),
        "-i",
        input,
        "-t",
        String(durSec),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "44100",
        "-acodec",
        "libmp3lame",
        "-b:a",
        "96k",
        out,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffmpeg not installed: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg audio exit ${code}: ${err.slice(-400)}`)),
    );
  });
}

function dedupeStrings(xs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of xs) {
    const k = x.trim().toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x.trim());
    }
  }
  return out;
}

function ffmpegFrame(input: string, t: number, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "ffmpeg",
      [
        "-y",
        "-ss",
        String(t),
        "-i",
        input,
        "-frames:v",
        "1",
        "-q:v",
        "5",
        "-vf",
        `scale=${FRAME_WIDTH}:-2`,
        out,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffmpeg not installed: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err}`)),
    );
  });
}

type VisionDraft = Omit<VibeObject, "id" | "source" | "createdAt" | "embedding"> & {
  weatherImplied: string;
};

// Two-pass Plan-and-Solve to ground the VibeObject in observed evidence
// instead of letting the model free-associate from a single vision call.
// Pass 1 inventories ONLY what's directly visible in the frames (palette
// hexes from real pixels, light sources with frame indices, etc) and
// refuses to invent. Pass 2 is text-only synthesis from those grounded
// observations into the canonical VibeObject shape, with conservative
// defaults whenever evidence is absent.

const OBSERVATIONS_PROMPT = `
You are a visual evidence inventory tool for a sensory analyst pipeline.
You will be given N frames sampled at uniform intervals from a video.

Your ONE job: list ONLY what you can directly see in the frames. No
inference, no "feels like", no atmosphere words. If a category has no
visible evidence in any frame, return an empty array — DO NOT invent.

Hard rules:
- For every observation, prefix with the frame index it came from, like
  "frame 3: warm tungsten pendant, bottom-right corner".
- paletteSamples must be at least 5 specific colors actually present in
  the frames, with hex codes drawn from real pixels (not generic
  "warm beige"-style guesses).
- Do not name a sound, a mood, or a music genre — those are inferred and
  belong in pass 2.
- Return strictly a JSON object matching the schema. No prose.
`.trim();

const SYNTHESIS_PROMPT = `
You are the sensory analyst for a magazine called Viber. You will receive
a JSON payload of grounded OBSERVATIONS extracted from video frames by an
inventory tool that was forbidden to infer.

Your job: synthesize a VibeObject from those observations. Cite, in the
"plan" field at the top of your output, which observation(s) drove each
non-trivial field decision.

Hard rules:
- Do not invent details that have no support in the observations. If
  weather evidence is empty, set weatherImplied to "". If density evidence
  is empty, set density to 0.5. If motion evidence is empty, set energy
  conservatively to 0.4. If timeOfDay evidence is empty, default to
  "afternoon".
- Use observations.paletteSamples for the palette field. Pick 3-4 of the
  most representative samples; reuse their hex codes verbatim.
- Music genre, soundscape, mood: these are downstream inferences — base
  them on lighting, props, and density evidence, but pick conservative
  options when evidence is thin. Do not write "vibey", "aesthetic",
  "lofi". Prefer concrete words.
- Title: editorial magazine cover, two clauses.
- One-liner: one sentence naming two specific anchors that appear in the
  observations.

Output strictly the JSON object. No prose.
`.trim();

type Observations = {
  reasoning: string;
  observations: {
    lightSources: string[];
    surfaces: string[];
    props: string[];
    timeOfDayEvidence: string[];
    weatherEvidence: string[];
    densityEvidence: string[];
    motionObserved: string[];
    paletteSamples: { name: string; hex: string }[];
  };
};

const OBSERVATIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reasoning", "observations"],
  properties: {
    reasoning: { type: "string" },
    observations: {
      type: "object",
      additionalProperties: false,
      required: [
        "lightSources",
        "surfaces",
        "props",
        "timeOfDayEvidence",
        "weatherEvidence",
        "densityEvidence",
        "motionObserved",
        "paletteSamples",
      ],
      properties: {
        lightSources: { type: "array", items: { type: "string" } },
        surfaces: { type: "array", items: { type: "string" } },
        props: { type: "array", items: { type: "string" } },
        timeOfDayEvidence: { type: "array", items: { type: "string" } },
        weatherEvidence: { type: "array", items: { type: "string" } },
        densityEvidence: { type: "array", items: { type: "string" } },
        motionObserved: { type: "array", items: { type: "string" } },
        paletteSamples: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "hex"],
            properties: {
              name: { type: "string" },
              hex: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

// Synthesis schema = VibeObject schema with a leading "plan" string. The
// VIBE_OBJECT_SCHEMA stays untouched in vibe-prompt.ts; we discard plan
// after parsing.
const VIBE_OBJECT_WITH_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", ...VIBE_OBJECT_SCHEMA.required],
  properties: {
    plan: { type: "string" },
    ...VIBE_OBJECT_SCHEMA.properties,
  },
} as const;

async function callVision(framesB64: string[]): Promise<VisionDraft> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const observations = await runObservationsPass(client, framesB64);
  const totalObs =
    observations.observations.lightSources.length +
    observations.observations.surfaces.length +
    observations.observations.props.length +
    observations.observations.timeOfDayEvidence.length +
    observations.observations.weatherEvidence.length +
    observations.observations.densityEvidence.length +
    observations.observations.motionObserved.length +
    observations.observations.paletteSamples.length;
  if (totalObs === 0) {
    throw new Error(
      "vision pass 1 returned zero observations across all categories — likely content filter or model issue",
    );
  }

  return runSynthesisPass(client, observations);
}

async function runObservationsPass(
  client: OpenAI,
  framesB64: string[],
): Promise<Observations> {
  const visionModel = process.env.VIBER_VISION_MODEL || VISION_MODEL;
  const chain = dedupe([visionModel, ...VISION_FALLBACKS]);

  let lastErr: unknown = null;
  for (const model of chain) {
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: OBSERVATIONS_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${framesB64.length} frames sampled from a video, in chronological order (frame 0 first). Inventory only what is directly visible. Cite frame indices.`,
              },
              ...framesB64.map((b64) => ({
                type: "image_url" as const,
                image_url: { url: `data:image/jpeg;base64,${b64}` },
              })),
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "Observations",
            schema: OBSERVATIONS_SCHEMA,
            strict: true,
          },
        },
      });
      const content = resp.choices[0]?.message?.content;
      if (!content) throw new Error("observations pass returned empty content");
      return JSON.parse(content) as Observations;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/model.*does not exist|not found|invalid model|404/i.test(msg)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("no vision model worked");
}

async function runSynthesisPass(
  client: OpenAI,
  observations: Observations,
): Promise<VisionDraft> {
  const resp = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: SYNTHESIS_PROMPT },
      {
        role: "user",
        content: `OBSERVATIONS (grounded inventory from frames):\n\n${JSON.stringify(observations, null, 2)}\n\nSynthesize the VibeObject. Cite which observations drove each field in the "plan" field.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "VibeObjectWithPlan",
        schema: VIBE_OBJECT_WITH_PLAN_SCHEMA,
        strict: true,
      },
    },
  });
  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error("synthesis pass returned empty content");
  const parsed = JSON.parse(content) as VisionDraft & { plan?: string };
  delete parsed.plan;
  return parsed;
}

function dedupe<T>(xs: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) if (!seen.has(x)) { seen.add(x); out.push(x); }
  return out;
}

function youtubeEmbedUrl(url: string): string {
  const m = /[?&]v=([^&]+)|youtu\.be\/([^?&]+)|youtube\.com\/embed\/([^?&]+)/.exec(
    url,
  );
  const id = m?.[1] ?? m?.[2] ?? m?.[3];
  return id ? `https://www.youtube.com/embed/${id}` : url;
}

function embedSource(d: VisionDraft): string {
  return [
    d.title,
    d.oneLiner,
    d.lighting,
    d.spatial,
    `palette: ${d.palette.map((p) => p.name).join(", ")}`,
    `motifs: ${d.visualMotifs.join(", ")}`,
    `soundscape: ${d.soundscape.join(", ")}`,
    `music: ${d.musicAnchor.genre} ${d.musicAnchor.tempoBpm}bpm`,
    `mood: ${d.moodTags.join(", ")}`,
    `time: ${d.timeOfDay}`,
  ].join("\n");
}
