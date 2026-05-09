// Push a locally-baked vibe's assets to Vercel Blob and rewrite the
// stored vibe so the URLs survive deploy. After this runs, the vibe
// renders identically on prod with real generated music + video.
//
// Usage:
//   npx tsx scripts/bake-fixture.ts <vibeId>

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { loadVibes, saveVibeToDisk } from "../lib/persist";

async function main() {
  const vibeId = process.argv[2];
  if (!vibeId) {
    console.error("usage: tsx scripts/bake-fixture.ts <vibeId>");
    process.exit(1);
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("BLOB_READ_WRITE_TOKEN missing");
    process.exit(1);
  }

  const all = await loadVibes();
  const vibe = all[vibeId];
  if (!vibe) {
    console.error(`vibe ${vibeId} not in store`);
    process.exit(1);
  }

  console.log(`baking ${vibeId} — ${vibe.title}\n`);

  // Walk the three asset URLs we care about. Each /uploads/X or /generated/X
  // path is read from public/, uploaded to Blob, and replaced inline.
  const rewrites: Array<[string, (newUrl: string) => void]> = [];
  if (vibe.source.audioSampleUrl?.startsWith("/")) {
    const url = vibe.source.audioSampleUrl;
    rewrites.push([url, (n) => (vibe.source.audioSampleUrl = n)]);
  }
  if (vibe.source.previewUrl?.startsWith("/")) {
    const url = vibe.source.previewUrl;
    rewrites.push([url, (n) => (vibe.source.previewUrl = n)]);
  }
  if (vibe.generatedAssets?.musicUrl?.startsWith("/")) {
    const url = vibe.generatedAssets.musicUrl;
    rewrites.push([url, (n) => (vibe.generatedAssets!.musicUrl = n)]);
  }
  if (vibe.generatedAssets?.previewVideoUrl?.startsWith("/")) {
    const url = vibe.generatedAssets.previewVideoUrl;
    rewrites.push([url, (n) => (vibe.generatedAssets!.previewVideoUrl = n)]);
  }

  for (const [localUrl, set] of rewrites) {
    const localPath = path.join(process.cwd(), "public", localUrl.replace(/^\//, ""));
    const buf = await fs.readFile(localPath);
    const ext = path.extname(localPath).slice(1).toLowerCase();
    const ct =
      ext === "mp4"
        ? "video/mp4"
        : ext === "mp3"
          ? "audio/mpeg"
          : "application/octet-stream";
    const filename = path.basename(localPath);
    const bucket = localUrl.startsWith("/uploads/") ? "uploads" : "generated";
    process.stdout.write(`  ↑ ${bucket}/${filename} (${Math.round(buf.byteLength / 1024)}kb) … `);
    const blob = await put(`${bucket}/${filename}`, buf, {
      access: "public",
      contentType: ct,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    console.log("ok");
    set(blob.url);
  }

  await saveVibeToDisk(vibe);
  console.log(`\nrewrote vibe ${vibeId}; persisted to ${process.env.DATABASE_URL ? "Neon DB" : "local sidecar"}`);
  console.log("\nasset URLs now:");
  console.log("  source.audioSampleUrl    :", vibe.source.audioSampleUrl);
  console.log("  source.previewUrl        :", vibe.source.previewUrl);
  console.log("  generatedAssets.music    :", vibe.generatedAssets?.musicUrl);
  console.log("  generatedAssets.video    :", vibe.generatedAssets?.previewVideoUrl);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
