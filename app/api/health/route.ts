import { NextResponse } from "next/server";
import { spawn } from "child_process";

export const runtime = "nodejs";

export async function GET() {
  const keys = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    elevenlabs: Boolean(process.env.ELEVENLABS_API_KEY),
    googleMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
    fal: Boolean(process.env.FAL_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    youtube: Boolean(process.env.YOUTUBE_API_KEY),
  };

  const models = {
    vision: process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
    image: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
    embed: process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large",
    elevenlabsTts: process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2",
    veoFal: process.env.VIBER_VEO_MODEL || "fal-ai/veo3/fast",
    veoGemini: process.env.VIBER_GEMINI_VEO_MODEL || "veo-3.1-fast-generate-preview",
    geminiAudio: process.env.VIBER_GEMINI_AUDIO_MODEL || "gemini-3-flash-preview",
    geminiImage:
      process.env.VIBER_GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview",
    lyria: process.env.VIBER_GEMINI_LYRIA_MODEL || "lyria-3-clip-preview",
  };

  const tools = {
    ytDlp: await binaryAvailable("yt-dlp", ["--version"]),
    // ffmpeg / ffprobe use single-dash flags. --version is treated as an
    // input filename and exits non-zero.
    ffmpeg: await binaryAvailable("ffmpeg", ["-version"]),
    ffprobe: await binaryAvailable("ffprobe", ["-version"]),
  };

  return NextResponse.json({
    flags: {
      VIBER_VIDEO_MODE: process.env.VIBER_VIDEO_MODE ?? "chain",
      VIBER_USE_VEO: process.env.VIBER_USE_VEO ?? "<unset>",
      VIBER_FRAME_FPS: process.env.VIBER_FRAME_FPS ?? "1",
      VIBER_FRAME_MAX_COUNT:
        process.env.VIBER_FRAME_MAX_COUNT ??
        process.env.VIBER_FRAME_COUNT ??
        "24",
      VIBER_STILL_COUNT: process.env.VIBER_STILL_COUNT ?? "<unset>",
      VIBER_MUSIC_BACKEND: process.env.VIBER_MUSIC_BACKEND ?? "elevenlabs",
      OPENAI_IMAGE_QUALITY: process.env.OPENAI_IMAGE_QUALITY ?? "<unset>",
    },
    keys,
    models,
    tools,
    venue: {
      lat: parseFloat(process.env.VIBER_VENUE_LAT ?? "1.3018"),
      lng: parseFloat(process.env.VIBER_VENUE_LNG ?? "103.8553"),
      radiusM: parseInt(process.env.VIBER_VENUE_RADIUS_M ?? "2000", 10),
    },
  });
}

function binaryAvailable(cmd: string, args: string[] = ["--version"]): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("close", (code) => resolve(code === 0));
  });
}
