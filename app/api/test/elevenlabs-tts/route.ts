import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { generateSpeech, VOICE_PRESETS, TTS_MODELS } from "@/lib/elevenlabs";

export const runtime = "nodejs";
export const maxDuration = 60;

const SAMPLE_TEXT =
  "A Tokyo coffee shop, late afternoon. The espresso machine speaks every ninety seconds. The rest is bossa nova at low volume.";

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ELEVENLABS_API_KEY missing" },
      { status: 500 },
    );
  }

  let body: {
    text?: string;
    voicePreset?: keyof typeof VOICE_PRESETS;
    voiceId?: string;
    modelId?: (typeof TTS_MODELS)[number];
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }

  const text = body.text?.trim() || SAMPLE_TEXT;

  const t0 = performance.now();
  try {
    const buf = await generateSpeech({
      text,
      voicePreset: body.voicePreset,
      voiceId: body.voiceId,
      modelId: body.modelId,
    });
    const ms = Math.round(performance.now() - t0);

    const fname = `test-tts-${Date.now()}.mp3`;
    const dir = path.join(process.cwd(), "public", "generated", "test");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, fname), buf);

    return NextResponse.json({
      ok: true,
      durationMs: ms,
      text,
      modelId:
        body.modelId ??
        (process.env.ELEVENLABS_MODEL_ID as (typeof TTS_MODELS)[number] | undefined) ??
        "eleven_multilingual_v2",
      voicePreset: body.voicePreset ?? null,
      voiceId:
        body.voiceId ??
        (body.voicePreset ? VOICE_PRESETS[body.voicePreset]?.id : undefined) ??
        process.env.ELEVENLABS_VOICE_ID ??
        VOICE_PRESETS.sarah.id,
      audioUrl: `/generated/test/${fname}`,
      bytes: buf.byteLength,
    });
  } catch (e) {
    const ms = Math.round(performance.now() - t0);
    const msg = e instanceof Error ? e.message : "elevenlabs tts failed";
    return NextResponse.json(
      { ok: false, durationMs: ms, text, error: msg },
      { status: 500 },
    );
  }
}
