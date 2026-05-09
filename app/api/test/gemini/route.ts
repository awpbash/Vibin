// Gemini 2.5 Flash audio understanding test endpoint. Downloads a short
// section of a YouTube video, rips audio with ffmpeg, sends it inline to
// Gemini, and returns the AudioAnalysis JSON.
//
// Body (all optional):
//   { url?: string, preset?: "tokyo" | "lisbon" | "hawker", durationSec?: number }
//
// Default preset is tokyo. durationSec is clamped 4..30.

import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { analyzeAudio } from "@/lib/gemini-audio";

export const runtime = "nodejs";
export const maxDuration = 120;

const PRESETS: Record<string, { url: string; label: string }> = {
  tokyo: {
    url: "https://www.youtube.com/watch?v=dx9aDku80kM",
    label: "tokyo coffee shop",
  },
  lisbon: {
    url: "https://www.youtube.com/watch?v=lLxK5fEzaAU",
    label: "lisbon jazz bar",
  },
  hawker: {
    url: "https://www.youtube.com/watch?v=pBKlFnh96Tg",
    label: "midnight hawker",
  },
};

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "GEMINI_API_KEY missing" },
      { status: 500 },
    );
  }

  let body: { url?: string; preset?: string; durationSec?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body, use defaults
  }

  const preset = body.preset && PRESETS[body.preset] ? body.preset : "tokyo";
  const url = body.url ?? PRESETS[preset].url;
  const durationSec = Math.min(Math.max(body.durationSec ?? 30, 4), 30);

  const id = `t-${Date.now().toString(36)}`;
  const tmp = path.join(process.cwd(), ".viber", "tmp", id);
  await fs.mkdir(tmp, { recursive: true });

  const stages: Array<{ name: string; ms: number; ok: boolean; note?: string }> = [];
  const t0 = performance.now();

  try {
    // Stage 1: yt-dlp audio-only download (much faster than full video)
    const audioRaw = path.join(tmp, "raw.m4a");
    const s1 = performance.now();
    await ytDlpAudio(url, audioRaw);
    stages.push({
      name: "yt-dlp",
      ms: Math.round(performance.now() - s1),
      ok: true,
    });

    // Stage 2: ffmpeg trim + transcode to 30s mp3 mono 96kbps
    const audioMp3 = path.join(tmp, "clip.mp3");
    const s2 = performance.now();
    const totalDur = await ffprobeDuration(audioRaw);
    const start = Math.max(0, totalDur / 2 - durationSec / 2);
    await ffmpegAudio(audioRaw, audioMp3, start, durationSec);
    const stat = await fs.stat(audioMp3);
    stages.push({
      name: "ffmpeg",
      ms: Math.round(performance.now() - s2),
      ok: true,
      note: `${stat.size} bytes`,
    });

    // Stage 3: Gemini 2.5 Flash audio analysis
    const buf = await fs.readFile(audioMp3);
    const s3 = performance.now();
    const analysis = await analyzeAudio(buf.toString("base64"), "audio/mp3");
    stages.push({
      name: "gemini",
      ms: Math.round(performance.now() - s3),
      ok: true,
    });

    return NextResponse.json({
      ok: true,
      durationMs: Math.round(performance.now() - t0),
      preset,
      url,
      label: PRESETS[preset]?.label,
      durationSec,
      stages,
      analysis,
      bytes: stat.size,
      // Approximate cost: gemini-2.5-flash audio = ~32 tokens/sec @ $0.30/M
      // → 30s ≈ 960 tokens ≈ $0.0003 input + tiny output ≈ $0.0005 total
      estCostUsd: Number(((durationSec * 32 * 0.3) / 1_000_000 + 0.0001).toFixed(5)),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "gemini audio test failed";
    return NextResponse.json(
      {
        ok: false,
        durationMs: Math.round(performance.now() - t0),
        preset,
        url,
        stages,
        error: msg,
      },
      { status: 500 },
    );
  } finally {
    fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}

// ---------- helpers ----------

function ytDlpAudio(url: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-f",
      "bestaudio[ext=m4a]/bestaudio",
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
      code === 0
        ? resolve()
        : reject(new Error(`yt-dlp exit ${code}: ${err.slice(-400)}`)),
    );
  });
}

function ffprobeDuration(p: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        p,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d.toString()));
    proc.stderr.on("data", (d) => (err += d.toString()));
    proc.on("error", (e) =>
      reject(new Error(`ffprobe not installed: ${e.message}`)),
    );
    proc.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffprobe exit ${code}: ${err}`));
      const n = parseFloat(out.trim());
      if (!isFinite(n) || n <= 0) return resolve(60);
      resolve(n);
    });
  });
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
        : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`)),
    );
  });
}
