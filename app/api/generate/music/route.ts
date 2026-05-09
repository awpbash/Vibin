import { NextResponse } from "next/server";
import { getVibe, saveVibe } from "@/lib/vibe-store";
import { generateMusicAsset } from "@/lib/generate";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  let body: { vibeId?: string; lengthMs?: number } = {};
  try {
    body = await req.json();
  } catch {
    // empty
  }
  const { vibeId, lengthMs } = body;
  if (!vibeId) return new NextResponse("missing vibeId", { status: 400 });

  const vibe = await getVibe(vibeId);
  if (!vibe) return new NextResponse("vibe not found", { status: 404 });

  // Cached?
  if (vibe.generatedAssets?.musicUrl) {
    return NextResponse.json({
      musicUrl: vibe.generatedAssets.musicUrl,
      prompt: vibe.generatedAssets.musicPrompt,
      lengthMs: vibe.generatedAssets.musicDurationMs,
      cached: true,
    });
  }

  const t0 = performance.now();
  try {
    const r = await generateMusicAsset(vibe, lengthMs ?? 90000);
    const next = {
      ...vibe,
      generatedAssets: {
        ...(vibe.generatedAssets ?? {}),
        musicUrl: r.url,
        musicPrompt: r.prompt,
        musicDurationMs: r.lengthMs,
      },
    };
    await saveVibe(next);

    return NextResponse.json({
      musicUrl: r.url,
      prompt: r.prompt,
      lengthMs: r.lengthMs,
      bytes: r.bytes,
      durationMs: Math.round(performance.now() - t0),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "music generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
