import { NextResponse } from "next/server";
import { getVibe, saveVibe } from "@/lib/mock-data";
import { generatePreview } from "@/lib/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { vibeId } = (await req.json()) as { vibeId?: string };
  if (!vibeId) return new NextResponse("missing vibeId", { status: 400 });
  const vibe = await getVibe(vibeId);
  if (!vibe) return new NextResponse("vibe not found", { status: 404 });

  const useMock = process.env.USE_MOCK_PIPELINE !== "false";

  // Already generated, return cached.
  if (vibe.generatedAssets?.previewVideoUrl) {
    return NextResponse.json(vibe.generatedAssets);
  }

  if (useMock) {
    // No real generation in mock mode; player renders palette gradient.
    return NextResponse.json({ previewVideoUrl: "" });
  }

  try {
    const result = await generatePreview(vibe);
    const next = {
      ...vibe,
      generatedAssets: { previewVideoUrl: result.previewVideoUrl },
    };
    await saveVibe(next);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "generate failed";
    return new NextResponse(msg, { status: 500 });
  }
}
