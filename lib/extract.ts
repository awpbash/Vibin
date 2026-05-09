// Real extraction pipeline. yt-dlp -> ffmpeg frames -> OpenAI vision ->
// VibeObject -> embedding -> persisted.
//
// Falls back to a fixture when USE_MOCK_PIPELINE !== "false".

import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { VIBE_EXTRACTION_PROMPT, VIBE_OBJECT_SCHEMA } from "./vibe-prompt";
import type { VibeObject } from "./types";

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5.5";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";

type ExtractInput =
  | { kind: "youtube"; url: string }
  | { kind: "upload"; videoPath: string; originalName?: string };

export async function extractFromYouTube(url: string): Promise<VibeObject> {
  return extract({ kind: "youtube", url });
}

export async function extractFromUpload(
  videoPath: string,
  originalName?: string,
): Promise<VibeObject> {
  return extract({ kind: "upload", videoPath, originalName });
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
    const frames = await sampleFrames(videoPath, tmp, 8, duration);
    const draft = await callVision(frames);

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
        ? { kind: "youtube", url: input.url }
        : { kind: "capture" };

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
        "3",
        "-vf",
        "scale=1280:-1",
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
  const resp = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: VIBE_EXTRACTION_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Eight frames sampled from a video. Extract the vibe.",
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
