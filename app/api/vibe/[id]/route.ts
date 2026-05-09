import { NextResponse } from "next/server";
import { getVibe, getPlacesForVibe } from "@/lib/mock-data";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const vibe = await getVibe(id);
  if (!vibe) return new NextResponse("not found", { status: 404 });
  const places = await getPlacesForVibe(id);
  return NextResponse.json({ vibe, places });
}
