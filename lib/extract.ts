// Real extraction pipeline. yt-dlp -> ffmpeg frames -> OpenAI vision ->
// VibeObject -> embedding -> persisted.
//
// Falls back to a fixture when USE_MOCK_PIPELINE !== "false".

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { VIBE_EXTRACTION_PROMPT, VIBE_OBJECT_SCHEMA } from "./vibe-prompt";
import { analyzeAudio } from "./gemini-audio";
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

// Pulls a 30s mono mp3 from the middle of the source video, persists
// it to public/uploads so it's a real artefact, and asks Gemini 3
// Flash to break it down. All failures are non-fatal — extraction
// continues with a vision-only vibe if audio analysis breaks.
async function runAudioAnalysis(
  videoPath: string,
  tmp: string,
  duration: number,
  vibeId: string,
): Promise<{ analysis: AudioAnalysis; sampleUrl: string } | undefined> {
  if (!process.env.GEMINI_API_KEY) return undefined;
  try {
    const tmpAudio = path.join(tmp, "audio.mp3");
    const start = Math.max(0, duration / 2 - 15);
    const dur = Math.min(30, Math.max(4, duration));
    await ffmpegAudio(videoPath, tmpAudio, start, dur);
    const buf = await fs.readFile(tmpAudio);

    // Persist the sample so it survives tmp cleanup and is playable.
    // This is the canonical "what does this place actually sound like"
    // artefact — the music generator's prompt anchors on its analysis.
    const publicDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(publicDir, { recursive: true });
    const sampleName = `${vibeId}-source-sample.mp3`;
    await fs.writeFile(path.join(publicDir, sampleName), buf);

    const analysis = await analyzeAudio(buf.toString("base64"), "audio/mp3");
    return { analysis, sampleUrl: `/uploads/${sampleName}` };
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

async function callVision(framesB64: string[]): Promise<VisionDraft> {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const chain = dedupe([VISION_MODEL, ...VISION_FALLBACKS]);

  let lastErr: unknown = null;
  for (const model of chain) {
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: VIBE_EXTRACTION_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `${framesB64.length} frames sampled from a video. Extract the vibe.`,
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
            name: "VibeObject",
            schema: VIBE_OBJECT_SCHEMA,
            strict: true,
          },
        },
      });
      const content = resp.choices[0]?.message?.content;
      if (!content) throw new Error("vision returned empty content");
      return JSON.parse(content) as VisionDraft;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (!/model.*does not exist|not found|invalid model|404/i.test(msg)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("no vision model worked");
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
