import { NextResponse } from "next/server";
import { getVibe, saveVibe } from "@/lib/vibe-store";
import { generatePreview } from "@/lib/generate";

export const runtime = "nodejs";
// Music + 4-clip Veo chain may run several minutes end-to-end.
// Hobby plan caps at 300s; on Pro/Enterprise we could push higher.
export const maxDuration = 300;

export async function POST(req: Request) {
  const { vibeId } = (await req.json()) as { vibeId?: string };
  if (!vibeId) return new NextResponse("missing vibeId", { status: 400 });
  const vibe = await getVibe(vibeId);
  if (!vibe) return new NextResponse("vibe not found", { status: 404 });

  if (vibe.generatedAssets?.previewVideoUrl) {
    return NextResponse.json({
      previewVideoUrl: vibe.generatedAssets.previewVideoUrl,
      durationSeconds: vibe.generatedAssets.videoDurationSeconds ?? null,
      musicUrl: vibe.generatedAssets.musicUrl ?? null,
      cached: true,
    });
  }

  try {
    const result = await generatePreview(vibe);
    const next = {
      ...vibe,
      generatedAssets: {
        ...(vibe.generatedAssets ?? {}),
        previewVideoUrl: result.previewVideoUrl,
        videoDurationSeconds: result.durationSeconds,
      },
    };
    await saveVibe(next);
    return NextResponse.json({
      previewVideoUrl: result.previewVideoUrl,
      durationSeconds: result.durationSeconds,
      musicUrl: next.generatedAssets?.musicUrl ?? null,
      cached: false,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generate failed";
    return new NextResponse(msg, { status: 500 });
  }
}
