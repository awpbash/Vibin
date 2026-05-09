import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { pickFixtureFromUrl, saveVibe } from "@/lib/mock-data";
import { extractFromUpload, extractFromYouTube } from "@/lib/extract";
import { cacheVibeIdForUrl, getCachedVibeIdForUrl } from "@/lib/persist";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const useMock = process.env.USE_MOCK_PIPELINE !== "false";
  const ct = req.headers.get("content-type") ?? "";

  // ---------- Multipart upload (recorded or selected video) ----------
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("video");
    if (!(file instanceof File)) {
      return new NextResponse("missing video file", { status: 400 });
    }

    if (useMock) {
      // Round-robin a fixture so the upload UX is demoable without keys.
      const ids = ["tokyo-coffee", "lisbon-jazz", "midnight-hawker"] as const;
      const fixId = ids[Math.floor(Math.random() * ids.length)];
      const v = pickFixtureFromUrl(`upload://${fixId}`);
      v.id = `${fixId}-upload-${Date.now().toString(36)}`;
      v.source = { kind: "capture" };
      v.title = v.title.replace(",", " (you sensed),");
      await saveVibe(v);
      await new Promise((r) => setTimeout(r, 600));
      return NextResponse.json({ vibeId: v.id });
    }

    // Real path: persist the upload and run the pipeline against the file.
    const uploadsDir = path.join(process.cwd(), ".viber", "uploads");
    await fs.mkdir(uploadsDir, { recursive: true });
    const ext = guessExt(file.name) ?? "mp4";
    const dest = path.join(uploadsDir, `${Date.now()}.${ext}`);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buf);

    try {
      const vibe = await extractFromUpload(dest, file.name);
      await saveVibe(vibe);
      return NextResponse.json({ vibeId: vibe.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "extract failed";
      return new NextResponse(msg, { status: 500 });
    } finally {
      // Keep the upload around for now (demo replay). Consider purging later.
    }
  }

  // ---------- JSON URL ----------
  const { url } = (await req.json()) as { url?: string };
  if (!url) return new NextResponse("missing url or video file", { status: 400 });

  if (useMock) {
    const vibe = pickFixtureFromUrl(url);
    await saveVibe(vibe);
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ vibeId: vibe.id });
  }

  const cached = await getCachedVibeIdForUrl(url);
  if (cached) return NextResponse.json({ vibeId: cached, cached: true });

  try {
    const vibe = await extractFromYouTube(url);
    await saveVibe(vibe);
    await cacheVibeIdForUrl(url, vibe.id);
    return NextResponse.json({ vibeId: vibe.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "extract failed";
    return new NextResponse(msg, { status: 500 });
  }
}

function guessExt(name: string): string | null {
  const m = /\.(\w{2,5})$/.exec(name);
  return m ? m[1].toLowerCase() : null;
}
