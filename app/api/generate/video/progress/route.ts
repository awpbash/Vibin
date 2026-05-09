import { NextResponse } from "next/server";
import { computePercent, getProgress } from "@/lib/video-progress";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("vibeId");
  if (!id) return new NextResponse("missing vibeId", { status: 400 });

  const p = getProgress(id);
  if (!p) {
    return NextResponse.json({
      stage: "idle",
      percent: 0,
      message: null,
      veoClipsTotal: 0,
      veoClipsCompleted: 0,
      elapsedMs: 0,
    });
  }

  return NextResponse.json({
    stage: p.stage,
    percent: computePercent(p),
    message: p.message ?? null,
    error: p.error ?? null,
    veoClipsTotal: p.veoClipsTotal ?? 0,
    veoClipsCompleted: p.veoClipsCompleted ?? 0,
    elapsedMs: Date.now() - p.startedAt,
  });
}
