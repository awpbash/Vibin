// JSON sidecar persistence so vibes and inferred place vibes survive a
// `next dev` restart. Solo build, single process, no DB.
//
// Files:
//   ./.viber/vibes.json         all vibes by id
//   ./.viber/places.json        google places + their inferred vibe id
//   ./.viber/by-url.json        youtube url -> vibeId, prevents re-extracting

import { promises as fs } from "fs";
import path from "path";
import type { Place, VibeObject } from "./types";

const dir = process.env.VIBE_DATA_DIR ?? path.join(process.cwd(), ".viber");

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
  return readJson<Record<string, VibeObject>>("vibes.json", {});
}

export async function saveVibeToDisk(v: VibeObject) {
  const all = await loadVibes();
  all[v.id] = v;
  await writeJson("vibes.json", all);
}

// ---------- URL cache ----------

export async function getCachedVibeIdForUrl(url: string): Promise<string | null> {
  const map = await readJson<Record<string, string>>("by-url.json", {});
  return map[url] ?? null;
}

export async function cacheVibeIdForUrl(url: string, vibeId: string) {
  const map = await readJson<Record<string, string>>("by-url.json", {});
  map[url] = vibeId;
  await writeJson("by-url.json", map);
}

// ---------- Places + inferred vibes ----------

export type StoredPlace = Place & { inferredVibeId?: string };

export async function loadPlaces(): Promise<Record<string, StoredPlace>> {
  return readJson<Record<string, StoredPlace>>("places.json", {});
}

export async function savePlaces(places: Record<string, StoredPlace>) {
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
  return readJson<Record<string, StoredBaseline>>("place-baselines.json", {});
}

export async function saveBaselines(
  baselines: Record<string, StoredBaseline>,
) {
  await writeJson("place-baselines.json", baselines);
}
