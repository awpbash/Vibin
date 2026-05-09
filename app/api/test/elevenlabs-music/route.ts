import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { generateMusic } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 120;

const PRESETS: Record<string, string> = {
  tokyo:
    "bossa nova, sparse, 90 bpm, intimate cafe, warm tungsten, minor seventh chords, instrumental, no vocals",
  lisbon:
    "modal jazz, late night, 78 bpm, brushed snare, muted trumpet, candlelit jazz bar, instrumental",
  hawker:
    "warm ambient bustle, no melody, 130 bpm pulse, kitchen percussion, tropical evening, instrumental",
  custom: "ambient, lo-fi, 90 bpm, instrumental",
};

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ELEVENLABS_API_KEY missing" },
      { status: 500 },
    );
  }

  let body: { prompt?: string; preset?: string; lengthMs?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty body, use defaults
  }

  const prompt =
    body.prompt ?? PRESETS[body.preset ?? "tokyo"] ?? PRESETS.tokyo;
  const lengthMs = Math.min(Math.max(body.lengthMs ?? 30000, 10000), 60000);

  const t0 = performance.now();
  try {
    const buf = await generateMusic({ prompt, lengthMs });
    const ms = Math.round(performance.now() - t0);

    const fname = `test-music-${Date.now()}.mp3`;
    const dir = path.join(process.cwd(), "public", "generated", "test");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fname), buf);

    return NextResponse.json({
      ok: true,
      durationMs: ms,
      prompt,
      lengthMs,
      audioUrl: `/generated/test/${fname}`,
      bytes: buf.byteLength,
    });
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : "elevenlabs music failed";
    return NextResponse.json(
      { ok: false, durationMs: ms, prompt, lengthMs, error: msg },
      { status: 500 },
    );
  }
}
