// Server-side proxy for Google Places photos. Keeps the Maps API key out of
// the client bundle and out of any URL rendered by the browser.

import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const name = url.searchParams.get("name");
  const h = url.searchParams.get("h") ?? "1024";
  if (!name || !name.startsWith("places/")) {
    return new NextResponse("bad name", { status: 400 });
  }
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return new NextResponse("missing key", { status: 500 });

  const upstream = `https://places.googleapis.com/v1/${name}/media?maxHeightPx=${encodeURIComponent(
    h,
  )}&key=${key}`;

  const res = await fetch(upstream, { redirect: "follow" });
  if (!res.ok) {
    return new NextResponse(`upstream ${res.status}`, { status: res.status });
  }
  const buf = await res.arrayBuffer();
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
