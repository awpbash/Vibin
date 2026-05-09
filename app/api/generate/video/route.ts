import { NextResponse } from "next/server";
import path from "path";
import { getVibe, saveVibe } from "@/lib/vibe-store";
import { generateVideoAsset } from "@/lib/generate";

export const runtime = "nodejs";
// Chain mode runs 4 Veo calls in parallel; each can take 60-180s.
// Allow up to 10 minutes (Vercel pro/enterprise; on hobby this caps lower).
export const maxDuration = 600;

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

  // Reuse music if it exists.
  let musicLocalPath: string | undefined;
  if (vibe.generatedAssets?.musicUrl) {
    musicLocalPath = path.join(
      process.cwd(),
      "public",
      vibe.generatedAssets.musicUrl.replace(/^\//, ""),
    );
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
