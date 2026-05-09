// Storage abstraction for generated assets (audio + video) and the
// 30s source-audio sample that the music generator uses as a reference.
//
// Dispatches:
//   BLOB_READ_WRITE_TOKEN set  →  Vercel Blob (survives Vercel deploys)
//   otherwise                  →  /public/generated and /public/uploads
//                                 (works locally, NOT on Vercel)
//
// Both branches return a public URL. Callers don't care which storage
// backend ran.

import { promises as fs } from "fs";
import path from "path";

export type StoredAsset = {
  url: string;          // public URL the browser can load
  localPath?: string;   // absolute filesystem path when stored locally
  size: number;         // bytes
};

export function hasBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

// Save bytes for a generated asset (mp3, mp4, png).
//   bucket: "generated" | "uploads"
//   filename: e.g. "v-abc123-music.mp3"
export async function saveAsset(
  bucket: "generated" | "uploads",
  filename: string,
  data: Buffer,
  contentType: string,
): Promise<StoredAsset> {
  if (hasBlobStorage()) {
    return saveToVercelBlob(bucket, filename, data, contentType);
  }
  return saveToPublicDir(bucket, filename, data);
}

async function saveToVercelBlob(
  bucket: "generated" | "uploads",
  filename: string,
  data: Buffer,
  contentType: string,
): Promise<StoredAsset> {
  // Lazy-load so we never bundle @vercel/blob into the client by accident
  // and so dev without the package installed doesn't crash.
  const { put } = await import("@vercel/blob");
  const blob = await put(`${bucket}/${filename}`, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return {
    url: blob.url,
    size: data.byteLength,
  };
}

async function saveToPublicDir(
  bucket: "generated" | "uploads",
  filename: string,
  data: Buffer,
): Promise<StoredAsset> {
  const dir = path.join(process.cwd(), "public", bucket);
  await fs.mkdir(dir, { recursive: true });
  const localPath = path.join(dir, filename);
  await fs.writeFile(localPath, data);
  return {
    url: `/${bucket}/${filename}`,
    localPath,
    size: data.byteLength,
  };
}

// Read bytes back from a stored asset URL. Used by the music bridge
// to load the source-audio sample for ffmpeg processing.
//   - https:// urls (Vercel Blob): fetched over HTTP
//   - /uploads/... paths (local):  read from public/ directly
export async function readAsset(url: string): Promise<Buffer> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`storage fetch ${res.status}: ${url}`);
    return Buffer.from(await res.arrayBuffer());
  }
  // Treat as a /public/-relative path
  const localPath = path.join(
    process.cwd(),
    "public",
    url.replace(/^\//, ""),
  );
  return fs.readFile(localPath);
}

// Convenience: write a temp file we want a usable absolute path for
// (e.g. ffmpeg needs to read from disk). Used when the source asset
// lives in Vercel Blob. Falls through to localPath if already on disk.
export async function localPathForAsset(
  url: string,
  tmpDir: string,
  filename: string,
): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const buf = await readAsset(url);
    await fs.mkdir(tmpDir, { recursive: true });
    const p = path.join(tmpDir, filename);
    await fs.writeFile(p, buf);
    return p;
  }
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}
