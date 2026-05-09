// Audio understanding test endpoint. Downloads a short section of a
// YouTube video, rips audio with ffmpeg into 3 × 10s slices, sends them
// to gpt-4o-audio-preview via the Self-Consistency analyzer, and
// returns the reconciled AudioAnalysis JSON.
//
// Body (all optional):
//   { url?: string, preset?: "tokyo" | "lisbon" | "hawker", durationSec?: number }
//
// Default preset is tokyo. durationSec is clamped 4..30.

import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { analyzeAudio } from "@/lib/audio-analysis";

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
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY missing" },
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
  const tmp = path.join(os.tmpdir(), "viber", id);
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

    // Stage 2: ffmpeg slice into 3 × 10s windows for self-consistency.
    const totalDur = await ffprobeDuration(audioRaw);
    const sliceLen = Math.min(10, Math.max(4, totalDur));
    const winStart = Math.max(0, totalDur / 2 - durationSec / 2);
    const slicePoints = [
      { start: 0, label: `intro (0-${Math.round(sliceLen)}s)` },
      { start: Math.max(0, winStart), label: `mid (~${Math.round(winStart)}s)` },
      { start: Math.max(0, totalDur - sliceLen), label: `outro (last ${Math.round(sliceLen)}s)` },
    ];
    const s2 = performance.now();
    const slices: { buf: Buffer; mime: string; label: string }[] = [];
    for (let i = 0; i < slicePoints.length; i++) {
      const out = path.join(tmp, `slice-${i}.mp3`);
      await ffmpegAudio(audioRaw, out, slicePoints[i].start, sliceLen);
      const buf = await fs.readFile(out);
      slices.push({ buf, mime: "audio/mp3", label: slicePoints[i].label });
    }
    const totalBytes = slices.reduce((a, s) => a + s.buf.byteLength, 0);
    stages.push({
      name: "ffmpeg-slices",
      ms: Math.round(performance.now() - s2),
      ok: true,
      note: `3 slices, ${totalBytes} bytes total`,
    });

    // Stage 3: gpt-4o-audio multi-slice Self-Consistency analysis
    const s3 = performance.now();
    const analysis = await analyzeAudio({ slices });
    stages.push({
      name: "gpt-4o-audio",
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
      bytes: totalBytes,
      // Approximate cost: gpt-4o-audio-preview ≈ $40/M audio tokens.
      // 3 slices × 10s × ~25 tokens/s = 750 audio tokens × 3 ≈ 2250
      // tokens input + ~600 output + a tiny gpt-5.4 reconcile call.
      // ≈ $0.10 per call.
      estCostUsd: 0.10,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "audio test failed";
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
