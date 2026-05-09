import { NextResponse } from "next/server";
import os from "os";
import path from "path";
import { promises as fs } from "fs";
import { getVibe, saveVibe } from "@/lib/vibe-store";
import { generateVideoAsset } from "@/lib/generate";
import { readAsset } from "@/lib/storage";

export const runtime = "nodejs";
// Chain mode runs 4 Veo calls in parallel; each can take 60-180s.
// Hobby plan caps at 300s; on Pro/Enterprise we could push higher.
export const maxDuration = 300;

export async function POST(req: Request) {
  let body: { vibeId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  const { vibeId } = body;
  if (!vibeId) return new NextResponse("missing vibeId", { status: 400 });

  const vibe = await getVibe(vibeId);
  if (!vibe) return new NextResponse("vibe not found", { status: 404 });

  // Cached?
  if (vibe.generatedAssets?.previewVideoUrl) {
    return NextResponse.json({
      videoUrl: vibe.generatedAssets.previewVideoUrl,
      durationSeconds: vibe.generatedAssets.videoDurationSeconds,
      cached: true,
    });
  }

  // Reuse music if it exists. Music URL might be local (/generated/...)
  // or remote (Vercel Blob https://). Either way, ffmpeg needs an
  // on-disk file path, so download blob URLs to tmp first.
  let musicLocalPath: string | undefined;
  const musicUrl = vibe.generatedAssets?.musicUrl;
  if (musicUrl) {
    if (musicUrl.startsWith("http://") || musicUrl.startsWith("https://")) {
      const buf = await readAsset(musicUrl);
      const tmpDir = path.join(os.tmpdir(), "viber", `music-${vibe.id}`);
      await fs.mkdir(tmpDir, { recursive: true });
      musicLocalPath = path.join(tmpDir, "music.mp3");
      await fs.writeFile(musicLocalPath, buf);
    } else {
      musicLocalPath = path.join(
        process.cwd(),
        "public",
        musicUrl.replace(/^\//, ""),
      );
    }
  }

  const t0 = performance.now();
  try {
    const r = await generateVideoAsset(vibe, musicLocalPath);
    const next = {
      ...vibe,
      generatedAssets: {
        ...(vibe.generatedAssets ?? {}),
        previewVideoUrl: r.url,
        videoDurationSeconds: r.durationSeconds,
      },
    };
    await saveVibe(next);

    return NextResponse.json({
      videoUrl: r.url,
      durationSeconds: r.durationSeconds,
      bytes: r.bytes,
      durationMs: Math.round(performance.now() - t0),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "video generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
