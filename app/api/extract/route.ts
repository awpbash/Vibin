import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { saveVibe } from "@/lib/vibe-store";
import { extractFromUpload, extractFromYouTube } from "@/lib/extract";
import { cacheVibeIdForUrl, getCachedVibeIdForUrl } from "@/lib/persist";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const ct = req.headers.get("content-type") ?? "";

  // ---------- Multipart upload ----------
  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("video");
    if (!(file instanceof File)) {
      return new NextResponse("missing video file", { status: 400 });
    }

    const ext = guessExt(file.name) ?? "mp4";
    const stamp = Date.now().toString(36);
    const slug = `upload-${stamp}-${Math.random().toString(36).slice(2, 6)}`;
    const fname = `${slug}.${ext}`;
    const publicDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(publicDir, { recursive: true });
    const dest = path.join(publicDir, fname);
    const buf = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(dest, buf);
    const previewUrl = `/uploads/${fname}`;
    const contentType = file.type || `video/${ext}`;

    try {
      const vibe = await extractFromUpload({
        videoPath: dest,
        originalName: file.name,
        previewUrl,
        contentType,
      });
      await saveVibe(vibe);
      return NextResponse.json({ vibeId: vibe.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "extract failed";
      return new NextResponse(msg, { status: 500 });
    }
  }

  // ---------- JSON URL ----------
  const { url } = (await req.json()) as { url?: string };
  if (!url) {
    return new NextResponse("missing url or video file", { status: 400 });
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
