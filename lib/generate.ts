// Generation pipeline. Split into music and video so the studio UI can
// trigger each step explicitly.
//
// Solo budget per full run (rough):
//   Multi-bridge music 60-90s            ~$0.30
//   4 Veo 3.1 Fast 8s clips (Gemini)     ~$4.80 (chain mode, real motion)
//   ffmpeg + storage                     free
// --------------------------------------------~$5.10
//
// Chain mode = first/last-frame interpolation. Clip 1 is text-to-video.
// Each subsequent clip is conditioned on the previous clip's last frame
// as its first frame, so the four 8s clips read as one ~32s continuous
// take. No static stills, no Ken Burns zoompan anywhere.
// hero-only mode is the cheap fallback: 1× 8s Veo, file loops in player.

import { spawn } from "child_process";
import { promises as fs, createWriteStream } from "fs";
import path from "path";
import {
  generateMusic,
  generateSoundEffects,
  musicPromptFromVibe,
  sfxPromptFromVibe,
} from "./elevenlabs";
import {
  generateVeoVideoBytes,
  generateLyriaMusicBytes,
} from "./gemini";
import { buildCreativeBrief } from "./creative-brief";
import { writeMusicPromptListeningToAudio } from "./music-prompt-audio";
import { saveVibe } from "./vibe-store";
import {
  bumpVeoCompleted,
  clearProgress,
  failProgress,
  setStage,
  startProgress,
} from "./video-progress";
import type { VibeObject } from "./types";

const FAL_KEY = process.env.FAL_API_KEY;
const VEO_MODEL = process.env.VIBER_VEO_MODEL || "fal-ai/veo3/fast";
// Image-to-video endpoint for chain continuations. Distinct from
// VEO_MODEL because Fal's text-to-video and image-to-video are
// separate endpoints with different request shapes.
const VEO_I2V_MODEL =
  process.env.VIBER_VEO_I2V_MODEL || "fal-ai/veo3/fast/image-to-video";
// How many 8s Veo clips to chain in chain mode. 4 = ~32s continuous.
const CHAIN_LENGTH = Math.max(
  2,
  parseInt(process.env.VIBER_CHAIN_LENGTH ?? "4", 10),
);
// Music backend:
//   "multi-bridge" — DEFAULT. Source(20s) ↔ Lyria(30s) ↔ Source(20s) ↔
//                    Lyria(30s) interleaved with 5s crossfades. The
//                    source re-anchors the feel twice across ~85s.
//   "bridge"       — Source(30s) → 5s xfade → Lyria(60s) = ~85s. One
//                    handoff. Simpler, less re-anchoring.
//   "lyria"        — Pure Lyria 3 Clip generation, no source bridge.
//   "elevenlabs"   — Pure ElevenLabs Music. Has Creator credits.
const MUSIC_BACKEND = (
  process.env.VIBER_MUSIC_BACKEND || "multi-bridge"
).toLowerCase();
// Crossfade duration when bridging source ↔ Lyria, in seconds.
const BRIDGE_CROSSFADE_SEC = parseFloat(
  process.env.VIBER_BRIDGE_CROSSFADE_SEC ?? "5",
);
// Whether to layer ElevenLabs Sound Effects room tone underneath the
// bridged music. Adds atmosphere of the place.
const BRIDGE_SFX_LAYER = process.env.VIBER_BRIDGE_SFX !== "false";
// Video mode:
//   "chain"      — N× 8s Veo clips, first/last-frame interpolated to
//                  one continuous take. Dedicated music underneath.
//   "hero-only"  — 1× 8s Veo with native audio. Player loops the file.
type VideoMode = "chain" | "hero-only";
const VIDEO_MODE: VideoMode = ((
  process.env.VIBER_VIDEO_MODE || "chain"
).toLowerCase() as VideoMode);

const W = 1280;
const H = 720;

// ---------- Music only ----------

export type MusicResult = {
  url: string;          // /generated/{id}-music.mp3
  localPath: string;
  prompt: string;
  lengthMs: number;
  bytes: number;
};

export async function generateMusicAsset(
  vibe: VibeObject,
  lengthMs = 90000,
): Promise<MusicResult> {
  await ensureBrief(vibe);
  const prompt = vibe.creativeBrief?.musicPrompt ?? musicPromptFromVibe(vibe);

  const dir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(dir, { recursive: true });

  let buf: Buffer;
  let extension = "mp3";
  let actualLengthMs = lengthMs;

  // ----- bridge / multi-bridge modes -----
  // Both modes mix real source audio with Lyria generated continuation.
  // multi-bridge interleaves source and Lyria for richer re-anchoring.
  if (MUSIC_BACKEND === "bridge" || MUSIC_BACKEND === "multi-bridge") {
    const sourcePath = sourceSampleAbsolutePath(vibe);
    if (!sourcePath) {
      console.warn(
        `${MUSIC_BACKEND} mode: vibe has no source audio sample, falling back to lyria`,
      );
    } else if (!process.env.GEMINI_API_KEY) {
      console.warn(
        `${MUSIC_BACKEND} mode: GEMINI_API_KEY missing, falling back to elevenlabs`,
      );
    } else {
      try {
        const result =
          MUSIC_BACKEND === "multi-bridge"
            ? await multiBridgeSourceWithLyria(vibe, prompt, sourcePath)
            : await bridgeSourceWithLyria(vibe, prompt, sourcePath);
        buf = result.buffer;
        actualLengthMs = result.durationMs;
        const fname = `${vibe.id}-music.${extension}`;
        const localPath = path.join(dir, fname);
        await fs.writeFile(localPath, buf);
        return {
          url: `/generated/${fname}`,
          localPath,
          prompt,
          lengthMs: actualLengthMs,
          bytes: buf.byteLength,
        };
      } catch (e) {
        console.error(
          `${MUSIC_BACKEND} mode failed, falling back to elevenlabs:`,
          e,
        );
      }
    }
  }

  // ----- pure lyria -----
  if (MUSIC_BACKEND === "lyria") {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        "VIBER_MUSIC_BACKEND=lyria but GEMINI_API_KEY is missing",
      );
    }
    const result = await generateLyriaMusicBytes({ prompt });
    buf = result.buffer;
    extension = result.mimeType.endsWith("wav") ? "wav" : "mp3";
    const fname = `${vibe.id}-music.${extension}`;
    const localPath = path.join(dir, fname);
    await fs.writeFile(localPath, buf);
    return {
      url: `/generated/${fname}`,
      localPath,
      prompt,
      lengthMs: await ffprobeMs(localPath).catch(() => actualLengthMs),
      bytes: buf.byteLength,
    };
  }

  // ----- elevenlabs (default fallback path) -----
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("ELEVENLABS_API_KEY missing");
  }
  buf = await generateMusic({ prompt, lengthMs });
  const fname = `${vibe.id}-music.${extension}`;
  const localPath = path.join(dir, fname);
  await fs.writeFile(localPath, buf);
  return {
    url: `/generated/${fname}`,
    localPath,
    prompt,
    lengthMs: actualLengthMs,
    bytes: buf.byteLength,
  };
}

// Resolve the on-disk path to the persisted source audio sample, or
// undefined if this vibe has none.
function sourceSampleAbsolutePath(vibe: VibeObject): string | undefined {
  const url = vibe.source?.audioSampleUrl;
  if (!url) return undefined;
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

// 30s source -> 5s ffmpeg acrossfade -> Lyria generated continuation,
// optional SFX layer mixed underneath. Returns bridged mp3 bytes +
// measured duration in ms.
async function bridgeSourceWithLyria(
  vibe: VibeObject,
  prompt: string,
  sourcePath: string,
): Promise<{ buffer: Buffer; durationMs: number }> {
  const tmp = path.join(process.cwd(), ".viber", "tmp", `bridge-${vibe.id}`);
  await fs.mkdir(tmp, { recursive: true });

  const lyriaPrompt = [
    "You are continuing an existing 30-second recording. The piece is already underway when you begin. Do NOT include a fresh intro from silence. Pick up at the same tempo, key, and texture as the source, develop the material for the next 60 seconds, then resolve to a soft close.",
    "",
    prompt,
  ].join("\n");

  const lyriaResult = await generateLyriaMusicBytes({ prompt: lyriaPrompt });
  const lyriaPath = path.join(tmp, "lyria.mp3");
  await fs.writeFile(lyriaPath, lyriaResult.buffer);

  const bridgedPath = path.join(tmp, "bridged.mp3");
  await ffmpegAcrossfade(
    sourcePath,
    lyriaPath,
    BRIDGE_CROSSFADE_SEC,
    bridgedPath,
  );

  const finalPath = await maybeLayerSfx(vibe, bridgedPath, tmp);
  const durationMs = await ffprobeMs(finalPath).catch(() => 0);
  const buffer = await fs.readFile(finalPath);

  fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  return { buffer, durationMs };
}

// Multi-bridge: interleaves source and Lyria. One Lyria call (~60s)
// then sliced in half. Source is sliced into two overlapping windows
// for variation. Stitched as src_a → xfade → lyria_a → xfade →
// src_b → xfade → lyria_b. Total ≈85s.
async function multiBridgeSourceWithLyria(
  vibe: VibeObject,
  prompt: string,
  sourcePath: string,
): Promise<{ buffer: Buffer; durationMs: number }> {
  const tmp = path.join(process.cwd(), ".viber", "tmp", `mbridge-${vibe.id}`);
  await fs.mkdir(tmp, { recursive: true });

  const lyriaPrompt = [
    "You are continuing an existing 30-second recording. The piece is already underway when you begin. Do NOT include a fresh intro from silence. Pick up at the same tempo, key, and texture as the source. Across 60 seconds, develop the material in two distinct passages so the second half feels evolved relative to the first. Stay in the same key throughout.",
    "",
    prompt,
  ].join("\n");

  const lyriaResult = await generateLyriaMusicBytes({ prompt: lyriaPrompt });
  const lyriaPath = path.join(tmp, "lyria.mp3");
  await fs.writeFile(lyriaPath, lyriaResult.buffer);

  // Slice 4 segments via single ffmpeg pass with atrim filters.
  // src_a = source[0..20], lyria_a = lyria[0..30],
  // src_b = source[10..30], lyria_b = lyria[30..60].
  // Each pair crossfaded by BRIDGE_CROSSFADE_SEC.
  const stitchedPath = path.join(tmp, "multi.mp3");
  const xf = BRIDGE_CROSSFADE_SEC;
  const filter = [
    `[0:a]atrim=0:20,asetpts=PTS-STARTPTS[s1]`,
    `[1:a]atrim=0:30,asetpts=PTS-STARTPTS[l1]`,
    `[0:a]atrim=10:30,asetpts=PTS-STARTPTS[s2]`,
    `[1:a]atrim=30:60,asetpts=PTS-STARTPTS[l2]`,
    `[s1][l1]acrossfade=d=${xf}:c1=tri:c2=tri[m1]`,
    `[m1][s2]acrossfade=d=${xf}:c1=tri:c2=tri[m2]`,
    `[m2][l2]acrossfade=d=${xf}:c1=tri:c2=tri[out]`,
  ].join(";");

  await ffmpegFilter(
    [sourcePath, lyriaPath],
    filter,
    "[out]",
    stitchedPath,
  );

  const finalPath = await maybeLayerSfx(vibe, stitchedPath, tmp);
  const durationMs = await ffprobeMs(finalPath).catch(() => 0);
  const buffer = await fs.readFile(finalPath);

  fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  return { buffer, durationMs };
}

// If BRIDGE_SFX_LAYER is enabled, generate a 22s ElevenLabs Sound
// Effects bed from the vibe's measured ambient layers, loop+trim it
// to the music length, and mix it underneath at -15 dB. Returns the
// path to the (possibly new) final mp3.
async function maybeLayerSfx(
  vibe: VibeObject,
  musicPath: string,
  tmp: string,
): Promise<string> {
  if (!BRIDGE_SFX_LAYER) return musicPath;
  if (!process.env.ELEVENLABS_API_KEY) return musicPath;
  try {
    const sfxPrompt = sfxPromptFromVibe({
      audioAnalysis: vibe.audioAnalysis,
      soundscape: vibe.soundscape,
      spatial: vibe.spatial,
      density: vibe.density,
    });
    const sfxBuf = await generateSoundEffects({
      text: sfxPrompt,
      durationSeconds: 22,
      promptInfluence: 0.45,
    });
    const sfxPath = path.join(tmp, "sfx.mp3");
    await fs.writeFile(sfxPath, sfxBuf);

    const musicMs = await ffprobeMs(musicPath).catch(() => 90000);
    const totalSec = musicMs / 1000;

    const mixedPath = path.join(tmp, "mixed.mp3");
    // Music at full volume, SFX looped + trimmed + ducked to -15 dB
    // (volume=0.18 ≈ -15 dB), then amix preserving music length.
    const filter =
      `[0:a]volume=1.0[a0];` +
      `[1:a]aloop=loop=-1:size=2e9,atrim=duration=${totalSec},volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, totalSec - 2)}:d=2[a1];` +
      `[a0][a1]amix=inputs=2:duration=first:dropout_transition=0[out]`;

    await ffmpegFilter([musicPath, sfxPath], filter, "[out]", mixedPath);
    return mixedPath;
  } catch (e) {
    console.warn("sfx layer failed, returning music without sfx:", e);
    return musicPath;
  }
}

// Run an arbitrary ffmpeg filter graph on N input files, mapping a
// labelled output to an mp3 file. Used by multi-bridge stitching and
// SFX mixing to keep all the audio routing in one place.
function ffmpegFilter(
  inputs: string[],
  filterComplex: string,
  outLabel: string,
  outPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args: string[] = ["-y"];
    for (const inp of inputs) args.push("-i", inp);
    args.push(
      "-filter_complex",
      filterComplex,
      "-map",
      outLabel,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      outPath,
    );
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffmpeg not installed: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg filter exit ${code}: ${err.slice(-400)}`)),
    );
  });
}

function ffmpegAcrossfade(
  aPath: string,
  bPath: string,
  crossfadeSec: number,
  outPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-i",
      aPath,
      "-i",
      bPath,
      "-filter_complex",
      `[0:a][1:a]acrossfade=d=${crossfadeSec}:c1=tri:c2=tri[out]`,
      "-map",
      "[out]",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      "-ar",
      "44100",
      outPath,
    ];
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffmpeg not installed: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`acrossfade exit ${code}: ${err.slice(-400)}`)),
    );
  });
}

function ffprobeMs(p: string): Promise<number> {
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
      resolve(Math.round((isFinite(n) ? n : 0) * 1000));
    });
  });
}

// ---------- Video (real motion only — no stills, no Ken Burns) ----------

export type VideoResult = {
  url: string;          // /generated/{id}.mp4
  durationSeconds: number;
  bytes: number;
};

export async function generateVideoAsset(
  vibe: VibeObject,
  musicLocalPath?: string,
): Promise<VideoResult> {
  if (!FAL_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("video gen needs FAL_API_KEY or GEMINI_API_KEY");
  }

  const tmp = path.join(process.cwd(), ".viber", "tmp", `gen-${vibe.id}`);
  const outDir = path.join(process.cwd(), "public", "generated");
  await fs.mkdir(tmp, { recursive: true });
  await fs.mkdir(outDir, { recursive: true });

  startProgress(vibe.id, "preparing creative brief");
  try {
    await ensureBrief(vibe);
  } catch (e) {
    console.error("ensureBrief failed:", e);
  }

  const cleanupTmp = () =>
    fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);

  // chain mode is the default. Either Fal or Gemini can do
  // image-to-video for continuations; whichever key is present wins,
  // with Fal preferred when both are set. If neither is set or chain
  // fails, drop to hero-only — never to a stills slideshow.
  if (VIDEO_MODE === "chain" && (FAL_KEY || process.env.GEMINI_API_KEY)) {
    try {
      const r = await generateChained(vibe, tmp, outDir, musicLocalPath);
      cleanupTmp();
      setStage(vibe.id, "done", { message: "complete" });
      clearProgress(vibe.id, 30000);
      return r;
    } catch (e) {
      console.error("chain mode failed, falling back to hero-only:", e);
      setStage(vibe.id, "veo", { message: "chain failed, trying hero-only" });
    }
  } else if (VIDEO_MODE === "chain") {
    console.warn(
      "chain mode requires FAL_API_KEY or GEMINI_API_KEY, falling back to hero-only",
    );
    setStage(vibe.id, "veo", { message: "no video key, hero-only mode" });
  }

  try {
    const r = await generateHeroOnly(vibe, tmp, outDir);
    cleanupTmp();
    setStage(vibe.id, "done", { message: "complete" });
    clearProgress(vibe.id, 30000);
    return r;
  } catch (e) {
    cleanupTmp();
    failProgress(vibe.id, e instanceof Error ? e.message : String(e));
    clearProgress(vibe.id, 60000);
    throw e;
  }
}

// ---------- Mode: chain (N Veo clips, first/last-frame interpolated) ----------
//
// Generates one continuous take by chaining N 8-second Veo clips:
//
//   clip 0: text-to-video (anchor)
//   clip 1: image-to-video, firstFrame = lastFrame(clip 0)
//   clip 2: image-to-video, firstFrame = lastFrame(clip 1)
//   ...
//
// The handoffs are seamless because each clip literally begins on the
// previous clip's final frame. We then concat (no crossfade) since the
// frames already match. Sequential, so total time ≈ N × Veo latency
// (typically 60-120s per clip, so ~4-8 minutes for N=4).
async function generateChained(
  vibe: VibeObject,
  tmp: string,
  outDir: string,
  musicLocalPath?: string,
): Promise<VideoResult> {
  const prompts = chainedVeoPromptsFromVibe(vibe, CHAIN_LENGTH);
  if (prompts.length < 2) {
    throw new Error("chain mode needs at least 2 prompts");
  }

  setStage(vibe.id, "veo", {
    veoClipsTotal: prompts.length,
    veoClipsCompleted: 0,
    message: `generating clip 1 of ${prompts.length}`,
  });

  const clips: string[] = [];
  let lastFramePath: string | null = null;

  for (let i = 0; i < prompts.length; i++) {
    setStage(vibe.id, "veo", {
      veoClipsTotal: prompts.length,
      veoClipsCompleted: i,
      message: `generating clip ${i + 1} of ${prompts.length}`,
    });

    const clipPath = path.join(tmp, `c${i}.mp4`);
    const firstFrame = lastFramePath
      ? await readImageAsBase64(lastFramePath)
      : undefined;

    try {
      await veoCallByPrompt({
        prompt: prompts[i],
        withAudio: false,
        outPath: clipPath,
        firstFrame,
      });
      clips.push(clipPath);
      bumpVeoCompleted(
        vibe.id,
        i + 1 < prompts.length
          ? `clip ${i + 1} done, generating clip ${i + 2} of ${prompts.length}`
          : `clip ${i + 1} of ${prompts.length} done`,
      );
    } catch (e) {
      console.error(`veo clip ${i} failed:`, e);
      // If clip 0 fails, the whole chain is dead. If a later clip
      // fails, ship what we have rather than spending another 90s on
      // a retry the user is already waiting for.
      if (i === 0) throw e;
      break;
    }

    // Extract last frame for the next iteration. Skip on the final
    // clip — nothing to chain into. If extraction fails, stop the
    // chain here and ship what we already have.
    if (i < prompts.length - 1) {
      const nextFrame = path.join(tmp, `c${i}-last.png`);
      try {
        await extractLastFrame(clipPath, nextFrame);
        lastFramePath = nextFrame;
      } catch (e) {
        console.error(`extractLastFrame after clip ${i} failed:`, e);
        break;
      }
    }
  }

  if (clips.length < 2) {
    throw new Error(`only ${clips.length}/${prompts.length} veo clips succeeded`);
  }

  setStage(vibe.id, "stitch", { message: "stitching with ffmpeg" });

  const outName = `${vibe.id}.mp4`;
  const outPath = path.join(outDir, outName);
  // Tiny crossfade (0.2s) masks any sub-pixel mismatch at the seam
  // without being long enough to read as a transition.
  const totalSeconds = await stitchClips({
    clips,
    music: musicLocalPath ?? null,
    out: outPath,
    crossfadeSeconds: 0.2,
  });

  const stat = await fs.stat(outPath);
  return {
    url: `/generated/${outName}`,
    durationSeconds: totalSeconds,
    bytes: stat.size,
  };
}

// Extract the final frame of a video as a PNG, for use as the next
// clip's firstFrame anchor. -sseof -1 seeks to 1s before EOF, then
// -update 1 -frames:v 1 writes a single frame.
async function extractLastFrame(videoPath: string, outPng: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const args = [
      "-y",
      "-sseof",
      "-1",
      "-i",
      videoPath,
      "-update",
      "1",
      "-frames:v",
      "1",
      outPng,
    ];
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) =>
      reject(new Error(`ffmpeg not installed: ${e.message}`)),
    );
    p.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`extractLastFrame exit ${code}: ${err.slice(-400)}`)),
    );
  });
}

async function readImageAsBase64(
  imagePath: string,
): Promise<{ mimeType: string; dataBase64: string }> {
  const buf = await fs.readFile(imagePath);
  const mimeType = imagePath.toLowerCase().endsWith(".jpg") ||
    imagePath.toLowerCase().endsWith(".jpeg")
    ? "image/jpeg"
    : "image/png";
  return { mimeType, dataBase64: buf.toString("base64") };
}

// ---------- Mode: hero-only (1 Veo with native audio, player loops) ----------

async function generateHeroOnly(
  vibe: VibeObject,
  tmp: string,
  outDir: string,
): Promise<VideoResult> {
  setStage(vibe.id, "veo", {
    veoClipsTotal: 1,
    veoClipsCompleted: 0,
    message: "generating hero clip",
  });
  const prompt = heroVeoPromptFromVibe(vibe);
  const veoPath = path.join(tmp, "hero.mp4");
  await veoCallByPrompt({
    prompt,
    withAudio: true,
    outPath: veoPath,
  });
  bumpVeoCompleted(vibe.id, "hero clip done");
  setStage(vibe.id, "stitch", { message: "writing final mp4" });

  // Just copy as the deliverable. Veo's native audio is the soundtrack.
  // The HTML player loops the file for ambient playback.
  const outName = `${vibe.id}.mp4`;
  const outPath = path.join(outDir, outName);
  await fs.copyFile(veoPath, outPath);

  const stat = await fs.stat(outPath);
  return {
    url: `/generated/${outName}`,
    durationSeconds: 8,
    bytes: stat.size,
  };
}

// ---------- Convenience: full pipeline ----------

export async function generatePreview(vibe: VibeObject): Promise<{
  previewVideoUrl: string;
  durationSeconds: number;
}> {
  let musicPath: string | undefined;
  try {
    const m = await generateMusicAsset(vibe);
    musicPath = m.localPath;
  } catch (e) {
    console.error("music gen failed, continuing without bed:", e);
  }
  const v = await generateVideoAsset(vibe, musicPath);
  return { previewVideoUrl: v.url, durationSeconds: v.durationSeconds };
}

// ---------- Brief (shared coherence layer) ----------

// Lazily attaches a creative brief to the vibe, then persists it. Once
// built, all four generators (3 stills + Veo + ElevenLabs) cite the
// same subject, so renders look like the same place from different
// angles instead of three drifting cafes.
async function ensureBrief(vibe: VibeObject): Promise<void> {
  if (vibe.creativeBrief) return;
  try {
    const brief = await buildCreativeBrief(vibe);

    // Tier 1 upgrade: if we have a persisted source audio sample and a
    // Gemini key, get an audio-listening pass to rewrite the music
    // prompt. The downstream music model still can't hear, but its
    // text prompt now contains specifics captured by direct listening.
    if (vibe.source?.audioSampleUrl && process.env.GEMINI_API_KEY) {
      try {
        const audioAware = await writeMusicPromptListeningToAudio(vibe, brief);
        if (audioAware && audioAware.length > 50) {
          brief.musicPrompt = audioAware;
        }
      } catch (e) {
        console.warn(
          "audio-aware music prompt failed, keeping text-only:",
          e,
        );
      }
    }

    vibe.creativeBrief = brief;
    await saveVibe(vibe);
  } catch (e) {
    console.error("creative brief failed, falling back to template:", e);
  }
}

// ---------- Prompts ----------

// Shared style/forbid tail used by every Veo prompt. Encodes the
// hard rules: this is documentary footage of a real place, the frame
// must be alive for the full 8 seconds, no cuts within the shot, no
// text or logos, no zoom or whip pan.
function veoStyleBlock(v: VibeObject): string {
  const palette = v.palette
    .map((p) => `${p.name} (${p.hex})`)
    .join(", ");
  return [
    `[STYLE]`,
    `35mm film grain, shallow depth of field, naturalistic documentary feel.`,
    `Lighting: ${v.lighting}.`,
    `Palette (must dominate the frame): ${palette}.`,
    `Time of day: ${v.timeOfDay}.`,
    `Mood: ${v.moodTags.slice(0, 4).join(", ")}.`,
    ``,
    `[FORBIDDEN]`,
    `- No still or frozen-feeling compositions. The frame must be alive throughout.`,
    `- No camera cuts within the shot — one continuous take.`,
    `- No zoom, no dolly push, no whip pan, no lens flare, no rack focus tricks.`,
    `- No posed actors looking at camera, no smiling-to-lens.`,
    `- No text, no logos, no captions, no UI overlays, no subtitles.`,
  ].join("\n");
}

function heroVeoPromptFromVibe(v: VibeObject): string {
  const subject =
    v.creativeBrief?.subject ?? `${v.spatial} with ${v.lighting}`;
  const heroDescription =
    v.creativeBrief?.heroShot?.description ??
    `master wide of ${v.spatial}, ${v.visualMotifs.slice(0, 3).join(", ")}`;
  const heroMotion =
    v.creativeBrief?.heroShot?.motion ??
    motionFrom(v);

  return [
    `[REFERENCE — what this shot is]`,
    `8-second continuous take. Master shot.`,
    `Scene: ${subject}`,
    `Specific framing: ${heroDescription}`,
    ``,
    `[MOTION — 8 seconds, continuous]`,
    `Camera: locked off OR very slow handheld drift. No deliberate camera move.`,
    `What is happening in frame across the FULL 8 seconds: ${heroMotion}`,
    `This is a slice of real life. People move at natural pace. Things are happening. The frame is alive throughout — never freezes on an empty composed shot.`,
    ``,
    `[AMBIENCE]`,
    `Soundscape: ${v.soundscape.slice(0, 3).join(", ")}.`,
    `Background music if any: ${v.musicAnchor.genre}, ${v.musicAnchor.tempoBpm} bpm.`,
    ``,
    veoStyleBlock(v),
  ].join("\n");
}

// Chain mode prompts: clip 0 is the hero text-to-video anchor. Clips
// 1..length-1 are CONTINUATION prompts — each is sent with the previous
// clip's last frame as its firstFrame, so the prompt instructs Veo to
// pick up motion from that exact frame and continue the take. The
// reader (Veo) literally sees the previous final frame, so we lean on
// the brief's shot motion descriptions to evolve the action over time
// rather than cutting to a different angle.
function chainedVeoPromptsFromVibe(v: VibeObject, length: number): string[] {
  const subject =
    v.creativeBrief?.subject ?? `${v.spatial} with ${v.lighting}`;
  const heroMotion = v.creativeBrief?.heroShot?.motion ?? motionFrom(v);
  const shotMotions = (v.creativeBrief?.shots ?? []).map((s) =>
    /\b(moving|sway|step|walk|pour|pull|stir|chop|toss|cross|gesture|turn|reach|breeze|wind|drift|flicker|rise|fall|drip|breathe|laugh|read|sip|type|write)/i.test(
      s.description,
    )
      ? s.description
      : `${s.description}. Motion: ${motionFrom(v)}`,
  );

  const prompts: string[] = [];

  // Clip 0 — text-to-video anchor (hero shot).
  prompts.push(heroVeoPromptFromVibe(v));

  // Clips 1..length-1 — continuation prompts. Cycle through brief
  // shot motions to evolve the action; if no shots, reuse heroMotion.
  for (let i = 1; i < length; i++) {
    const motion =
      shotMotions.length > 0
        ? shotMotions[(i - 1) % shotMotions.length]
        : heroMotion;
    prompts.push(continuationVeoPrompt(v, subject, motion, i, length));
  }

  return prompts;
}

// Continuation prompt: Veo will receive a first-frame image. The prompt
// must tell it to stay in that exact frame's space (same room, same
// camera, same lighting) and continue the action for 8 more seconds.
function continuationVeoPrompt(
  v: VibeObject,
  subject: string,
  motion: string,
  index: number,
  total: number,
): string {
  return [
    `[REFERENCE — this is a continuation, not a new shot]`,
    `An image is provided as the FIRST FRAME of this clip. The clip is segment ${
      index + 1
    } of ${total} in one continuous take.`,
    `Camera position, lens, lighting, and the entire spatial setup must EXACTLY MATCH the provided first frame. Do NOT cut to a new angle. Do NOT teleport the camera. Do NOT change the time of day or weather. Do NOT introduce new characters who weren't already plausibly present.`,
    `Scene reference (for atmosphere only — the first frame is ground truth): ${subject}`,
    ``,
    `[MOTION — pick up at the first frame and continue for 8 seconds]`,
    `Camera: locked off OR very slow handheld drift, exactly continuing whatever subtle drift was happening at the end of the previous clip. No new camera move.`,
    `What develops in the frame over the next 8 seconds: ${motion}`,
    `Anyone visible in the first frame must continue moving plausibly forward in time — they don't reset. New activity can enter the frame from offscreen edges.`,
    ``,
    veoStyleBlock(v),
  ].join("\n");
}

// Fallback motion description used when the brief has no heroShot.
// Each return value describes 8 full seconds of activity, not a moment.
function motionFrom(v: VibeObject): string {
  if (v.energy < 0.3) {
    return "a single patron reads at the table for the duration; light dapples through leaves outside the window in a steady breeze; a server crosses the background once around second 5";
  }
  if (v.energy < 0.6) {
    return "two patrons in conversation at one table, hands gesturing with cups; a third figure walks past the window; the barista wipes the counter and pulls one shot during the take";
  }
  return "the cook tosses noodles in a wok with visible flame, plates a dish, hands it to a waiting patron; a queue is visible behind; foot traffic crosses the foreground throughout";
}

// ---------- Veo (Gemini preferred when chaining; Fal otherwise) ----------

type VeoCallOpts = {
  prompt: string;
  withAudio: boolean;
  outPath: string;
  // Optional first-frame anchor for image-to-video continuation. When
  // present, the call MUST route through Gemini Veo (Fal's text-only
  // veo3/fast endpoint can't accept an image input).
  firstFrame?: { mimeType: string; dataBase64: string };
};

async function veoCallByPrompt(opts: VeoCallOpts): Promise<string> {
  // Both Fal and Gemini can do image-to-video. Prefer Fal when
  // FAL_KEY is set (cheaper + no Veo quota issues). Fall back to
  // Gemini if only it's available.
  if (FAL_KEY) return generateVeoViaFal(opts);
  if (process.env.GEMINI_API_KEY) return generateVeoViaGemini(opts);
  throw new Error("neither FAL_API_KEY nor GEMINI_API_KEY set");
}

async function generateVeoViaFal(opts: VeoCallOpts): Promise<string> {
  // Image-to-video uses a different Fal endpoint than text-to-video,
  // and takes image_url. Fal accepts a data: URI so we can ship the
  // PNG bytes inline without a separate upload step.
  const isI2V = Boolean(opts.firstFrame);
  const endpoint = isI2V ? VEO_I2V_MODEL : VEO_MODEL;
  const body: Record<string, unknown> = {
    prompt: opts.prompt,
    aspect_ratio: "16:9",
    duration: "8s",
    generate_audio: opts.withAudio,
    resolution: "720p",
  };
  if (opts.firstFrame) {
    body.image_url = `data:${opts.firstFrame.mimeType};base64,${opts.firstFrame.dataBase64}`;
  }

  const res = await fetch(`https://fal.run/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY!}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`fal veo ${res.status} (${endpoint}): ${await res.text()}`);
  }
  const data = (await res.json()) as { video?: { url?: string } };
  const url = data.video?.url;
  if (!url) throw new Error("fal veo response missing video url");
  await downloadTo(url, opts.outPath);
  return opts.outPath;
}

async function generateVeoViaGemini(opts: VeoCallOpts): Promise<string> {
  const buf = await generateVeoVideoBytes({
    prompt: opts.prompt,
    durationSeconds: 8,
    generateAudio: opts.withAudio,
    resolution: "720p",
    aspectRatio: "16:9",
    firstFrame: opts.firstFrame,
  });
  await fs.writeFile(opts.outPath, buf);
  return opts.outPath;
}

// ---------- Stitch ----------
// Chain-mode stitch: N video clips back-to-back with tiny crossfades,
// with the dedicated music track muxed underneath (Veo audio is muted
// by generating the clips with generateAudio=false). Each clip is
// assumed to be 8 seconds.
type StitchClipsOpts = {
  clips: string[];
  music: string | null;
  out: string;
  crossfadeSeconds: number;
};

async function stitchClips(o: StitchClipsOpts): Promise<number> {
  const { clips, music, out, crossfadeSeconds } = o;
  const clipCount = clips.length;
  if (clipCount === 0) throw new Error("no clips to stitch");

  const args: string[] = ["-y"];
  for (const c of clips) args.push("-i", c);
  if (music) args.push("-stream_loop", "-1", "-i", music);
  const musicIndex = clipCount;

  const parts: string[] = [];

  clips.forEach((_, i) => {
    parts.push(
      `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,` +
        `crop=${W}:${H},setsar=1,fps=25[v${i}]`,
    );
  });

  let chainLabel = "v0";
  let runningOffset = 8 - crossfadeSeconds;
  for (let i = 1; i < clipCount; i++) {
    const next = `vx${i}`;
    parts.push(
      `[${chainLabel}][v${i}]xfade=transition=fade:duration=${crossfadeSeconds}:offset=${runningOffset}[${next}]`,
    );
    chainLabel = next;
    runningOffset += 8 - crossfadeSeconds;
  }

  const totalSeconds = clipCount * 8 - (clipCount - 1) * crossfadeSeconds;

  let audioMap: string | null = null;
  if (music) {
    parts.push(
      `[${musicIndex}:a]aloop=loop=-1:size=2e9,atrim=duration=${totalSeconds},` +
        `afade=t=in:st=0:d=1.5,` +
        `afade=t=out:st=${Math.max(0, totalSeconds - 2)}:d=2,` +
        `aresample=44100[aout]`,
    );
    audioMap = "[aout]";
  }

  const filter = parts.join(";");
  args.push("-filter_complex", filter, "-map", `[${chainLabel}]`);
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
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
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
  if (!res.ok) {
    throw new Error(`download failed ${res.status} ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(outPath, buf);
  void createWriteStream;
}
