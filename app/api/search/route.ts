import { NextResponse } from "next/server";
import { getPlacesForVibe, getVibe } from "@/lib/vibe-store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("vibeId");
  if (!id) return new NextResponse("missing vibeId", { status: 400 });
  const vibe = await getVibe(id);
  if (!vibe) return new NextResponse("vibe not found", { status: 404 });

  const places = await getPlacesForVibe(id);
  return NextResponse.json({ vibe, places });
}
