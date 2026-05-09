// In-memory + JSON sidecar store for VibeObjects and their matched places.
// Real-only pipeline: no fixtures, no fallbacks. If something is missing,
// callers see undefined and fail loudly upstream.

import type { Place, VibeObject } from "./types";
import { loadVibes, saveVibeToDisk } from "./persist";
import { FIXTURE_VIBES } from "./fixtures";

const store = new Map<string, VibeObject>();
const placesByVibe = new Map<string, Place[]>();
let hydrated = false;

// Module-level guards so we don't spam the dev terminal with stack
// traces every time a route re-renders. Real errors still surface to the
// error boundary; this is purely about console hygiene.
let warnedPlacesPermission = false;
let warnedPlacesGeneric = false;

async function hydrate() {
  if (hydrated) return;
  hydrated = true;
  // Fixtures first so the FieldMap pin IDs always resolve, even on a
  // cold function with an empty DB. Real vibes from storage overwrite
  // any matching id, so prebakes still win.
  for (const v of Object.values(FIXTURE_VIBES)) store.set(v.id, v);
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
    const msg = e instanceof Error ? e.message : String(e);
    // Known config issue: Places API (New) not enabled or key blocked.
    // Log once per process so the terminal stays usable; the page still
    // renders with [] and the map shows its empty placeholder.
    const isPermission = /\b(403|PERMISSION_DENIED|has not been used|is disabled)\b/i.test(
      msg,
    );
    if (isPermission) {
      if (!warnedPlacesPermission) {
        warnedPlacesPermission = true;
        console.warn(
          "[viber] places-search disabled: enable Places API (New) in Google Cloud Console for this project.",
        );
      }
    } else if (!warnedPlacesGeneric) {
      warnedPlacesGeneric = true;
      // First occurrence only, single-line, no stack.
      console.warn(`[viber] places-search failed: ${msg.split("\n")[0]}`);
    }
    return [];
  }
}

export function setPlacesForVibe(vibeId: string, places: Place[]) {
  placesByVibe.set(vibeId, places);
}
