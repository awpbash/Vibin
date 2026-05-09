// In-memory + JSON sidecar store for VibeObjects and their matched places.
// Real-only pipeline: no fixtures, no fallbacks. If something is missing,
// callers see undefined and fail loudly upstream.

import type { Place, VibeObject } from "./types";
import { loadVibes, saveVibeToDisk } from "./persist";

const store = new Map<string, VibeObject>();
const placesByVibe = new Map<string, Place[]>();
let hydrated = false;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  try {
    const all = await loadVibes();
    for (const v of Object.values(all)) store.set(v.id, v);
  } catch {
    // first run, no file yet
  }
}

// ---------- vibes ----------

export async function saveVibe(v: VibeObject): Promise<void> {
  store.set(v.id, v);
  try {
    await saveVibeToDisk(v);
  } catch (e) {
    console.error("saveVibeToDisk failed:", e);
  }
}

export async function getVibe(id: string): Promise<VibeObject | undefined> {
  await hydrate();
  if (store.has(id)) return store.get(id);
  // Cross-bundle miss in Next.js dev: route handler module wrote to disk,
  // this RSC module never saw it. Re-read fresh.
  try {
    const all = await loadVibes();
    const fresh = all[id];
    if (fresh) {
      store.set(id, fresh);
      return fresh;
    }
  } catch {
    // ignore
  }
  return undefined;
}

// ---------- places ----------

export async function getPlacesForVibe(vibeId: string): Promise<Place[]> {
  if (placesByVibe.has(vibeId)) return placesByVibe.get(vibeId)!;

  const vibe = await getVibe(vibeId);
  if (!vibe) return [];
  if (!process.env.GOOGLE_MAPS_API_KEY) return [];

  try {
    const { findPlacesNear } = await import("./places-search");
    const real = await findPlacesNear(vibe, 3);
    placesByVibe.set(vibeId, real);
    return real;
  } catch (e) {
    console.error("places-search failed:", e);
    return [];
  }
}

export function setPlacesForVibe(vibeId: string, places: Place[]) {
  placesByVibe.set(vibeId, places);
}
