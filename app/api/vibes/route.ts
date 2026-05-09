// GET /api/vibes — list past vibes, newest first.
//   ?limit=N (default 50, max 200)

import { NextResponse } from "next/server";
import { listVibes } from "@/lib/persist";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const limitParam = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(
    Math.max(parseInt(limitParam ?? "50", 10) || 50, 1),
    200,
  );
  const vibes = await listVibes(limit);
  return NextResponse.json({
    count: vibes.length,
    vibes: vibes.map((v) => ({
      id: v.id,
      title: v.title,
      oneLiner: v.oneLiner,
      palette: v.palette,
      timeOfDay: v.timeOfDay,
      moodTags: v.moodTags,
      musicAnchor: v.musicAnchor,
      createdAt: v.createdAt,
      source: {
        kind: v.source.kind,
        url: v.source.url,
        previewUrl: v.source.previewUrl,
      },
      hasMusic: Boolean(v.generatedAssets?.musicUrl),
      hasVideo: Boolean(v.generatedAssets?.previewVideoUrl),
    })),
  });
}
