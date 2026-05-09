// Persistence dispatch. When DATABASE_URL is set we use Neon Postgres
// via lib/db/. Otherwise we fall back to JSON sidecar files in
// .viber/ so dev keeps working without a database. Same API in both
// branches — callers (lib/vibe-store.ts) don't care.
//
// Files used in JSON-fallback mode:
//   ./.viber/vibes.json         all vibes by id
//   ./.viber/places.json        google places + their inferred vibe id
//   ./.viber/by-url.json        youtube url -> vibeId, prevents re-extracting
//   ./.viber/place-baselines.json   inferred vibe per google place id

import { promises as fs } from "fs";
import os from "os";
import path from "path";
import type { Place, VibeObject } from "./types";
import { hasDatabase } from "./db/client";
import {
  dbCacheVibeIdForUrl,
  dbGetCachedVibeIdForUrl,
  dbListVibes,
  dbLoadBaselines,
  dbLoadPlaces,
  dbLoadVibes,
  dbSaveBaselines,
  dbSavePlaces,
  dbSaveVibe,
} from "./db/repo";

// On Vercel only /tmp is writable at runtime. When DATABASE_URL is set
// we never hit this branch anyway, but if it's ever missing in prod we
// don't want JSON writes to crash the route.
const onVercel = Boolean(process.env.VERCEL);
const dir =
  process.env.VIBE_DATA_DIR ??
  (onVercel
    ? path.join(os.tmpdir(), "viber-data")
    : path.join(process.cwd(), ".viber"));

async function ensureDir() {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const buf = await fs.readFile(path.join(dir, name), "utf8");
    return JSON.parse(buf) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(name: string, data: unknown) {
  await ensureDir();
  await fs.writeFile(path.join(dir, name), JSON.stringify(data, null, 2));
}

// ---------- Vibes ----------

export async function loadVibes(): Promise<Record<string, VibeObject>> {
  if (hasDatabase()) return dbLoadVibes();
  return readJson<Record<string, VibeObject>>("vibes.json", {});
}

export async function listVibes(limit = 50): Promise<VibeObject[]> {
  if (hasDatabase()) return dbListVibes(limit);
  const all = await loadVibes();
  return Object.values(all)
    .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
    .slice(0, limit);
}

export async function saveVibeToDisk(v: VibeObject) {
  if (hasDatabase()) {
    await dbSaveVibe(v);
    return;
  }
  const all = await loadVibes();
  all[v.id] = v;
  await writeJson("vibes.json", all);
}

// ---------- URL cache ----------

export async function getCachedVibeIdForUrl(
  url: string,
): Promise<string | null> {
  if (hasDatabase()) return dbGetCachedVibeIdForUrl(url);
  const map = await readJson<Record<string, string>>("by-url.json", {});
  return map[url] ?? null;
}

export async function cacheVibeIdForUrl(url: string, vibeId: string) {
  if (hasDatabase()) {
    await dbCacheVibeIdForUrl(url, vibeId);
    return;
  }
  const map = await readJson<Record<string, string>>("by-url.json", {});
  map[url] = vibeId;
  await writeJson("by-url.json", map);
}

// ---------- Places + inferred vibes ----------

export type StoredPlace = Place & { inferredVibeId?: string };

export async function loadPlaces(): Promise<Record<string, StoredPlace>> {
  if (hasDatabase()) return dbLoadPlaces();
  return readJson<Record<string, StoredPlace>>("places.json", {});
}

export async function savePlaces(places: Record<string, StoredPlace>) {
  if (hasDatabase()) {
    await dbSavePlaces(places);
    return;
  }
  await writeJson("places.json", places);
}

// ---------- Place baseline vibes ----------
// Keyed by Google Place id. Stores the full inferred VibeObject + cachedAt
// so cold starts can rehydrate without re-hitting OpenAI.

export type StoredBaseline = VibeObject & {
  googlePlaceId: string;
  cachedAt: number;
};

export async function loadBaselines(): Promise<Record<string, StoredBaseline>> {
  if (hasDatabase()) return dbLoadBaselines();
  return readJson<Record<string, StoredBaseline>>("place-baselines.json", {});
}

export async function saveBaselines(
  baselines: Record<string, StoredBaseline>,
) {
  if (hasDatabase()) {
    await dbSaveBaselines(baselines);
    return;
  }
  await writeJson("place-baselines.json", baselines);
}
