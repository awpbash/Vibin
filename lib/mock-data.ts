import type { Place, VibeObject } from "./types";
import { loadVibes, saveVibeToDisk } from "./persist";

// In-memory store layered over a JSON sidecar. Hydrated lazily on first
// read. Solo-mode persistence: vibes survive `next dev` restarts.

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

export async function saveVibe(v: VibeObject) {
  store.set(v.id, v);
  // Best-effort, do not block the request if disk write fails.
  saveVibeToDisk(v).catch(() => undefined);
}

export async function getVibe(id: string): Promise<VibeObject | undefined> {
  await hydrate();
  return store.get(id) ?? FIXTURES[id];
}

export async function getPlacesForVibe(vibeId: string): Promise<Place[]> {
  await hydrate();
  if (placesByVibe.has(vibeId)) return placesByVibe.get(vibeId)!;

  // Real mode: live Google Maps Places search ranked by cosine vs the
  // queried vibe's embedding. Cached per vibeId for the session.
  const useMock = process.env.USE_MOCK_PIPELINE !== "false";
  if (!useMock && !FIXTURES[vibeId]) {
    const vibe = store.get(vibeId);
    if (vibe?.embedding && process.env.GOOGLE_MAPS_API_KEY) {
      try {
        const { findPlacesNear } = await import("./places-search");
        const real = await findPlacesNear(vibe, 3);
        if (real.length) {
          placesByVibe.set(vibeId, real);
          return real;
        }
      } catch (e) {
        console.error("places-search failed, falling through to fixtures:", e);
      }
    }
  }

  if (PLACES_FOR[vibeId]) return PLACES_FOR[vibeId];
  const v = store.get(vibeId) ?? FIXTURES[vibeId];
  if (v) {
    if (v.title.toLowerCase().includes("tokyo")) return PLACES_FOR["tokyo-coffee"];
    if (v.title.toLowerCase().includes("lisbon")) return PLACES_FOR["lisbon-jazz"];
    if (v.title.toLowerCase().includes("hawker")) return PLACES_FOR["midnight-hawker"];
  }
  return PLACES_FOR.default;
}

export function setPlacesForVibe(vibeId: string, places: Place[]) {
  placesByVibe.set(vibeId, places);
}

// ---------- Fixtures ----------

export const FIXTURES: Record<string, VibeObject> = {
  "tokyo-coffee": {
    id: "tokyo-coffee",
    source: {
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=dx9aDku80kM",
      title: "Tokyo coffee shop ambience, rain, jazz, 4 hours",
    },
    title: "A Tokyo Coffee Shop, Late Afternoon",
    oneLiner:
      "Warm tungsten on stained wood. The espresso machine speaks every ninety seconds. Bossa at low volume.",
    palette: [
      { name: "warm tungsten", hex: "#d4a059" },
      { name: "stained walnut", hex: "#5a3a26" },
      { name: "cream paper", hex: "#e9dcc6" },
      { name: "rain glass", hex: "#7d8a86" },
    ],
    lighting:
      "low, warm, indoor tungsten with one cool fill from a rain-streaked window",
    spatial:
      "intimate, low ceilings, narrow counter, eight to twelve seats visible",
    visualMotifs: [
      "espresso machine",
      "ceramic cups",
      "open notebook",
      "potted fern",
      "rain on glass",
    ],
    density: 0.45,
    energy: 0.28,
    timeOfDay: "afternoon",
    soundscape: [
      "espresso machine, every 90s",
      "low chatter, two languages",
      "page turns",
      "cup on saucer",
      "rain, far",
    ],
    musicAnchor: {
      genre: "bossa nova, sparse",
      tempoBpm: 92,
      key: "C major",
      referenceTrack: "Antonio Carlos Jobim, Águas de Março, instrumental",
    },
    moodTags: ["focused", "cinematic", "introspective", "cozy"],
    createdAt: Date.now(),
  },

  "lisbon-jazz": {
    id: "lisbon-jazz",
    source: {
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=lLxK5fEzaAU",
      title: "Lisbon jazz bar, vinyl, late night",
    },
    title: "A Lisbon Jazz Bar, After Eleven",
    oneLiner:
      "Oxblood velvet and the warm hiss of vinyl. A trumpet that knows it is being listened to.",
    palette: [
      { name: "oxblood velvet", hex: "#7e2a2a" },
      { name: "candle gold", hex: "#caa257" },
      { name: "deep ink", hex: "#1f1a18" },
      { name: "smoke grey", hex: "#5e5852" },
    ],
    lighting: "candlelight, table lamps, pools rather than wash",
    spatial: "low room, brick, small stage, twenty close seats",
    visualMotifs: [
      "double bass leaning",
      "wine glasses",
      "vinyl on turntable",
      "framed photos",
      "ashtray on bar",
    ],
    density: 0.7,
    energy: 0.55,
    timeOfDay: "late-night",
    soundscape: [
      "muted trumpet",
      "brushed snare",
      "glass on wood",
      "Portuguese, low",
      "needle hiss",
    ],
    musicAnchor: {
      genre: "modal jazz, late",
      tempoBpm: 78,
      key: "D minor",
      referenceTrack: "Miles Davis, Blue in Green, live",
    },
    moodTags: ["sultry", "romantic", "slow", "private"],
    createdAt: Date.now(),
  },

  "midnight-hawker": {
    id: "midnight-hawker",
    source: {
      kind: "youtube",
      url: "https://www.youtube.com/watch?v=pBKlFnh96Tg",
      title: "Midnight hawker centre, Singapore",
    },
    title: "A Hawker Centre, Past Midnight",
    oneLiner:
      "Fluorescent green over plastic stools. Wok smoke. Three languages, none of them quiet.",
    palette: [
      { name: "fluorescent green", hex: "#9bb86b" },
      { name: "wok char", hex: "#2a2620" },
      { name: "neon red", hex: "#c8412c" },
      { name: "plastic blue", hex: "#5a78a3" },
    ],
    lighting: "overhead fluorescents, hard, with red signage glow",
    spatial: "covered open-air, plastic stools, long communal tables, vast",
    visualMotifs: [
      "wok flame",
      "red paper menu",
      "metal chopsticks",
      "stainless steel trays",
      "hanging fan",
    ],
    density: 0.85,
    energy: 0.8,
    timeOfDay: "late-night",
    soundscape: [
      "wok over flame",
      "metal on metal",
      "Hokkien, Mandarin, English",
      "ceiling fan whir",
      "ice scoop",
    ],
    musicAnchor: {
      genre: "ambient bustle, no music",
      tempoBpm: 130,
    },
    moodTags: ["alive", "communal", "unpretentious", "sweaty"],
    createdAt: Date.now(),
  },
};

// Three or four places per vibe within ~2km of central Singapore as a stand-in
// for the venue. Real version: Google Maps Places nearbySearch.

const PLACES_FOR: Record<string, Place[]> = {
  "tokyo-coffee": [
    {
      id: "tcs-1",
      name: "Apartment Coffee",
      address: "161 Lavender St, 02-06",
      neighbourhood: "Lavender",
      distanceMeters: 980,
      walkMinutes: 12,
      rating: 4.7,
      photoUrl:
        "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.93,
      whyThisMatches:
        "Warm tungsten over stained wood, an espresso machine that punctuates the room every minute, low chatter in two languages. The bossa is yours to imagine but the rest is already there.",
      hours: "8am to 5pm",
      openNow: true,
      location: { lat: 1.3094, lng: 103.8636 },
    },
    {
      id: "tcs-2",
      name: "Nylon Coffee Roasters",
      address: "4 Everton Park, 01-40",
      neighbourhood: "Everton",
      distanceMeters: 1700,
      walkMinutes: 21,
      rating: 4.6,
      photoUrl:
        "https://images.unsplash.com/photo-1559496417-e7f25cb247f3?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.84,
      whyThisMatches:
        "Cream walls and dark walnut counters. The same restraint, less rain, fewer windows.",
      hours: "8:30am to 6pm",
      openNow: true,
      location: { lat: 1.2746, lng: 103.8338 },
    },
    {
      id: "tcs-3",
      name: "% Arabica Arab Street",
      address: "56 Arab St",
      neighbourhood: "Kampong Glam",
      distanceMeters: 1200,
      walkMinutes: 15,
      rating: 4.4,
      photoUrl:
        "https://images.unsplash.com/photo-1442975631115-c4f7b05b8a2c?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.78,
      whyThisMatches:
        "Whiter, brighter, more crowded. The espresso machine and the ceramics carry over.",
      hours: "8am to 7pm",
      openNow: true,
      location: { lat: 1.3022, lng: 103.8595 },
    },
  ],

  "lisbon-jazz": [
    {
      id: "ljb-1",
      name: "Maduro",
      address: "40A Duxton Hill",
      neighbourhood: "Tanjong Pagar",
      distanceMeters: 1100,
      walkMinutes: 14,
      rating: 4.6,
      photoUrl:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.91,
      whyThisMatches:
        "Live trio most nights, oxblood interior, candles on tables. Closer to the source than anywhere else within a kilometre.",
      hours: "6pm to 1am",
      openNow: true,
      location: { lat: 1.2766, lng: 103.8419 },
    },
    {
      id: "ljb-2",
      name: "Bar Cicheti",
      address: "10 Jiak Chuan Rd",
      neighbourhood: "Keong Saik",
      distanceMeters: 1500,
      walkMinutes: 18,
      rating: 4.5,
      photoUrl:
        "https://images.unsplash.com/photo-1485872299712-99cb18ed72e6?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.79,
      whyThisMatches:
        "Italian rather than Portuguese, but the candlelight, low brick, and slow tempo carry over.",
      hours: "5pm to midnight",
      openNow: true,
      location: { lat: 1.2787, lng: 103.8395 },
    },
    {
      id: "ljb-3",
      name: "Atlas Bar",
      address: "600 North Bridge Rd",
      neighbourhood: "Bugis",
      distanceMeters: 1300,
      walkMinutes: 16,
      rating: 4.7,
      photoUrl:
        "https://images.unsplash.com/photo-1543007630-9710e4a00a20?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.71,
      whyThisMatches:
        "Far grander than Lisbon. The gold tones and the late-night energy still translate.",
      hours: "5pm to 1am",
      openNow: true,
      location: { lat: 1.3008, lng: 103.8589 },
    },
  ],

  "midnight-hawker": [
    {
      id: "mh-1",
      name: "Old Airport Road Food Centre",
      address: "51 Old Airport Rd",
      neighbourhood: "Mountbatten",
      distanceMeters: 1800,
      walkMinutes: 22,
      rating: 4.5,
      photoUrl:
        "https://images.unsplash.com/photo-1555126634-323283e090fa?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.92,
      whyThisMatches:
        "Long communal tables, plastic stools, fluorescents above and signage red below. Open very late.",
      hours: "open 24h, mostly",
      openNow: true,
      location: { lat: 1.308, lng: 103.886 },
    },
    {
      id: "mh-2",
      name: "Tekka Centre",
      address: "665 Buffalo Rd",
      neighbourhood: "Little India",
      distanceMeters: 1100,
      walkMinutes: 14,
      rating: 4.3,
      photoUrl:
        "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.84,
      whyThisMatches:
        "Three languages, the same fluorescent palette, more spice in the air.",
      hours: "until 10pm",
      openNow: false,
      location: { lat: 1.306, lng: 103.85 },
    },
    {
      id: "mh-3",
      name: "Lau Pa Sat",
      address: "18 Raffles Quay",
      neighbourhood: "Downtown",
      distanceMeters: 900,
      walkMinutes: 11,
      rating: 4.2,
      photoUrl:
        "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.78,
      whyThisMatches:
        "Less raw, but the satay smoke after eight pm gets close.",
      hours: "open 24h",
      openNow: true,
      location: { lat: 1.281, lng: 103.85 },
    },
  ],

  default: [
    {
      id: "default-1",
      name: "Apartment Coffee",
      address: "161 Lavender St",
      neighbourhood: "Lavender",
      distanceMeters: 980,
      walkMinutes: 12,
      rating: 4.7,
      photoUrl:
        "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=1200&q=70",
      matchScore: 0.82,
      whyThisMatches:
        "A reasonable match on palette and density. We can refine once you tell us which feeling you want louder.",
      hours: "8am to 5pm",
      openNow: true,
      location: { lat: 1.3094, lng: 103.8636 },
    },
  ],
};

export function pickFixtureFromUrl(url: string): VibeObject {
  const u = url.toLowerCase();
  if (u.includes("dx9adku80km")) return FIXTURES["tokyo-coffee"];
  if (u.includes("llxk5fezaau")) return FIXTURES["lisbon-jazz"];
  if (u.includes("pbklfnh96tg")) return FIXTURES["midnight-hawker"];
  // Round-robin a fixture for unknown URLs so the demo can always proceed.
  const ids = Object.keys(FIXTURES);
  const i = Math.abs(hash(url)) % ids.length;
  const base = FIXTURES[ids[i]];
  return {
    ...base,
    id: `derived-${i}-${Date.now()}`,
    source: { kind: "youtube", url },
  };
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
