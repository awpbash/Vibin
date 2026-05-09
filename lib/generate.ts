// Generation pipeline. VibeObject -> 60s ambient preview MP4 in /public/generated.
//
// Strategy: stills (cheap) carry most of the runtime, Veo Fast is the hero
// segment with native audio, ffmpeg stitches with crossfades.
//
// Solo budget per preview (rough):
//   1× Veo 3 Fast 8s w/ audio (Fal):        ~$1.20
//   4× GPT Image 2 stills, 1536x1024:        ~$0.68
//   ffmpeg + storage:                        ~free
// ----------------------------------------------------------- ~$1.88

import { spawn } from "child_process";
import { promises as fs, createWriteStream } from "fs";
import path from "path";
import OpenAI from "openai";
import type { VibeObject } from "./types";

const FAL_KEY = process.env.FAL_API_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const USE_VEO = process.env.VIBER_USE_VEO !== "false";
const VEO_MODEL = process.env.VIBER_VEO_MODEL || "fal-ai/veo3/fast";

export type GenerateResult = {
  previewVideoUrl: string;
  durationSeconds: number;
};

export async function generatePreview(vibe: VibeObject): Promise<GenerateResult> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY missing");

  const id = vibe.id;
  const tmp = path.join(process.cwd(), ".viber", "tmp", `gen-${id}`);
  const outDir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(tmp, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  // 1. Generate stills (parallel).
  const stillPrompts = stillPromptsFromVibe(vibe);
  const stillPaths: string[] = await Promise.all(
    stillPrompts.map((p, i) => generateStill(p, path.join(tmp, `s${i}.png`))),
  );

  // 2. Generate Veo hero clip (best-effort).
  let veoPath: string | null = null;
  if (USE_VEO && FAL_KEY) {
    try {
      veoPath = await generateVeoClip(vibe, path.join(tmp, "veo.mp4"));
    } catch (e) {
      console.error("veo failed, continuing stills-only:", e);
      veoPath = null;
    }
  }

  // 3. Stitch with ffmpeg.
  const outName = `${id}.mp4`;
  const outPath = path.join(outDir, outName);
  const totalSeconds = await stitch({
    stills: stillPaths,
    veo: veoPath,
    out: outPath,
    perStillSeconds: 12,
    crossfadeSeconds: 1.2,
  });

  // 4. Cleanup tmp (keep outputs).
  fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);

  return {
    previewVideoUrl: `/generated/${outName}`,
    durationSeconds: totalSeconds,
  };
}

// ---------- Prompts ----------

function stillPromptsFromVibe(v: VibeObject): string[] {
  const base = [
    `Cinematic still of ${v.spatial}.`,
    `Lighting: ${v.lighting}.`,
    `Palette: ${v.palette.map((p) => `${p.name} (${p.hex})`).join(", ")}.`,
    `Visible motifs: ${v.visualMotifs.join(", ")}.`,
    `Time of day: ${v.timeOfDay}.`,
    `Mood: ${v.moodTags.join(", ")}.`,
    "Photographic, no text, no logos, 35mm film grain.",
  ].join(" ");
  return [
    `${base} Wide establishing shot.`,
    `${base} Tighter detail shot, foreground texture.`,
    `${base} Low-angle, looking up.`,
    `${base} Through a window or doorway, framed.`,
  ];
}

function veoPromptFromVibe(v: VibeObject): string {
  return [
    `8 second cinematic shot of ${v.spatial}.`,
    `Lighting: ${v.lighting}.`,
    `Visible: ${v.visualMotifs.slice(0, 3).join(", ")}.`,
    `Slow camera move. Subtle motion: ${motionFrom(v)}.`,
    `Soundscape: ${v.soundscape.slice(0, 3).join(", ")}.`,
    `Background music: ${v.musicAnchor.genre}, ${v.musicAnchor.tempoBpm} bpm.`,
    `Mood: ${v.moodTags.join(", ")}.`,
    "No text, no logos. 35mm, shallow depth of field.",
  ].join(" ");
}

function motionFrom(v: VibeObject): string {
  if (v.energy < 0.3) return "steam rising, leaves shifting, candle flicker";
  if (v.energy < 0.6) return "slow pan, person moving across frame";
  return "wok flame, fast hands, ambient motion";
}

// ---------- Image generation ----------

async function generateStill(prompt: string, outPath: string): Promise<string> {
  const client = new OpenAI({ apiKey: OPENAI_KEY });
  const r = await client.images.generate({
    model: IMAGE_MODEL,
    prompt,
    size: "1536x1024",
    n: 1,
  });
  const item = r.data?.[0];
  if (!item) throw new Error("image gen returned no data");
  if (item.b64_json) {
    await fs.writeFile(outPath, Buffer.from(item.b64_json, "base64"));
    return outPath;
  }
  if (item.url) {
    await downloadTo(item.url, outPath);
    return outPath;
  }
  throw new Error("image gen returned neither b64 nor url");
}

// ---------- Veo via Fal ----------

async function generateVeoClip(v: VibeObject, outPath: string): Promise<string> {
  if (!FAL_KEY) throw new Error("FAL_API_KEY missing");
  const prompt = veoPromptFromVibe(v);

  // Synchronous endpoint. Veo Fast takes ~60-90s. Headers per Fal docs.
  const res = await fetch(`https://fal.run/${VEO_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      aspect_ratio: "16:9",
      duration: "8s",
      generate_audio: true,
      resolution: "720p",
    }),
  });

  if (!res.ok) {
    throw new Error(`fal veo ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { video?: { url?: string } };
  const url = data.video?.url;
  if (!url) throw new Error("veo response missing video url");
  await downloadTo(url, outPath);
  return outPath;
}

// ---------- Stitching ----------

type StitchOpts = {
  stills: string[];
  veo: string | null;
  out: string;
  perStillSeconds: number;
  crossfadeSeconds: number;
};

async function stitch(o: StitchOpts): Promise<number> {
  const { stills, veo, out, perStillSeconds, crossfadeSeconds } = o;
  const W = 1280;
  const H = 720;

  // Build a slideshow from stills with Ken Burns + xfade transitions.
  // If Veo is available, append it at the end (its own audio plays then).
  const stillCount = stills.length;
  if (stillCount === 0) throw new Error("no stills to stitch");

  // ffmpeg inputs: each still as an image looped for perStillSeconds.
  const args: string[] = ["-y"];
  for (const s of stills) {
    args.push("-loop", "1", "-t", String(perStillSeconds), "-i", s);
  }
  if (veo) args.push("-i", veo);

  // Build filter graph.
  const parts: string[] = [];

  // Ken Burns + scale each still to canvas.
  stills.forEach((_, i) => {
    parts.push(
      `[${i}:v]scale=${W * 1.1}:${H * 1.1}:force_original_aspect_ratio=increase,` +
        `crop=${W * 1.1}:${H * 1.1},` +
        `zoompan=z='min(zoom+0.0008,1.18)':d=${perStillSeconds * 25}:s=${W}x${H}:fps=25,` +
        `setsar=1[v${i}]`,
    );
  });

  // Chain xfades across stills.
  let chainLabel = "v0";
  let runningOffset = perStillSeconds - crossfadeSeconds;
  for (let i = 1; i < stillCount; i++) {
    const next = `vx${i}`;
    parts.push(
      `[${chainLabel}][v${i}]xfade=transition=fade:duration=${crossfadeSeconds}:offset=${runningOffset}[${next}]`,
    );
    chainLabel = next;
    runningOffset += perStillSeconds - crossfadeSeconds;
  }

  // Append Veo if available, with crossfade.
  let videoOut = chainLabel;
  let audioMap: string | null = null;
  let totalSeconds =
    stillCount * perStillSeconds - (stillCount - 1) * crossfadeSeconds;

  if (veo) {
    const veoIndex = stillCount;
    parts.push(
      `[${veoIndex}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[vveo]`,
    );
    parts.push(
      `[${chainLabel}][vveo]xfade=transition=fade:duration=${crossfadeSeconds}:offset=${runningOffset}[vfinal]`,
    );
    videoOut = "vfinal";
    totalSeconds += 8 - crossfadeSeconds;
    // Pad audio so it spans the whole timeline. Silence in the still
    // section, Veo audio over its own segment.
    const silentSecs = stillCount * perStillSeconds - (stillCount - 1) * crossfadeSeconds;
    parts.push(
      `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${silentSecs}[asilent]`,
    );
    parts.push(`[${veoIndex}:a]aresample=44100[aveo]`);
    parts.push(`[asilent][aveo]concat=n=2:v=0:a=1[aout]`);
    audioMap = "[aout]";
  }

  const filter = parts.join(";");
  args.push("-filter_complex", filter, "-map", `[${videoOut}]`);
  if (audioMap) args.push("-map", audioMap);

  args.push(
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-r",
    "25",
    "-movflags",
    "+faststart",
  );
  if (audioMap) args.push("-c:a", "aac", "-b:a", "128k");
  args.push(out);

  await runFFmpeg(args);
  return Math.round(totalSeconds);
}

function runFFmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, {
      stdio: ["ignore", "ignore", "pipe"],
    });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffmpeg not installed: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`ffmpeg exit ${code}: ${err.slice(-2000)}`)),
    );
  });
}

async function downloadTo(url: string, outPath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`download failed ${res.status} ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
  void createWriteStream;
}
