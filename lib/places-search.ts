// Real Google Maps Places search + baseline vibe inference for cafes
// near the venue. Cached aggressively because place photos and reviews
// are stable for the duration of the hackathon.

import OpenAI from "openai";
import type { Place, VibeObject } from "./types";
import { cosine } from "./search";
import { PLACE_BASELINE_PROMPT, VIBE_OBJECT_SCHEMA } from "./vibe-prompt";
import { loadPlaces, savePlaces } from "./persist";

const VISION_MODEL = process.env.OPENAI_VISION_MODEL || "gpt-5.5";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";

const VENUE_LAT = parseFloat(process.env.VIBER_VENUE_LAT ?? "1.3018");
const VENUE_LNG = parseFloat(process.env.VIBER_VENUE_LNG ?? "103.8553");
const RADIUS_M = parseInt(process.env.VIBER_VENUE_RADIUS_M ?? "2000", 10);

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  shortFormattedAddress?: string;
  location?: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  photos?: { name: string }[];
  reviews?: {
    text?: { text?: string };
    originalText?: { text?: string };
    rating?: number;
  }[];
  editorialSummary?: { text?: string };
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  types?: string[];
};

type CachedBaseline = VibeObject & {
  googlePlaceId: string;
  cachedAt: number;
};

const cache = new Map<string, CachedBaseline>();

export async function findPlacesNear(
  query: VibeObject,
  k = 3,
): Promise<Place[]> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY missing");
  }

  const candidates = await searchNearby();
  if (!candidates.length) return [];

  // Hydrate cache from disk (lazy, once).
  await hydrateCache();

  // Infer baseline vibe for each candidate (cached).
  const enriched = await Promise.all(
    candidates.slice(0, 10).map(async (gp) => {
      const baseline = await getOrInferBaseline(gp);
      return { gp, baseline };
    }),
  );

  // Cosine vs query.
  const ranked = enriched
    .map(({ gp, baseline }) => ({
      gp,
      baseline,
      score:
        query.embedding && baseline.embedding
          ? cosine(query.embedding, baseline.embedding)
          : 0.7,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);

  // Generate "why this matches" for top-K (in parallel).
  const whys = await Promise.all(
    ranked.map(({ baseline }) => generateWhy(query, baseline)),
  );

  // Persist updated cache.
  await persistCache();

  return ranked.map(({ gp, score }, i) => projectToPlace(gp, score, whys[i]));
}

// ---------- Google Maps calls ----------

async function searchNearby(): Promise<GooglePlace[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY!,
        "X-Goog-FieldMask": [
          "places.id",
          "places.displayName",
          "places.formattedAddress",
          "places.shortFormattedAddress",
          "places.location",
          "places.rating",
          "places.userRatingCount",
          "places.photos",
          "places.reviews",
          "places.editorialSummary",
          "places.regularOpeningHours",
          "places.types",
        ].join(","),
      },
      body: JSON.stringify({
        includedTypes: ["cafe"],
        maxResultCount: 12,
        rankPreference: "POPULARITY",
        locationRestriction: {
          circle: {
            center: { latitude: VENUE_LAT, longitude: VENUE_LNG },
            radius: RADIUS_M,
          },
        },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`places searchNearby ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: GooglePlace[] };
  return data.places ?? [];
}

function placePhotoUrl(name: string, maxHeightPx = 1024): string {
  return `https://places.googleapis.com/v1/${name}/media?maxHeightPx=${maxHeightPx}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
}

// ---------- Baseline vibe inference ----------

async function getOrInferBaseline(gp: GooglePlace): Promise<CachedBaseline> {
  if (cache.has(gp.id)) return cache.get(gp.id)!;
  const baseline = await inferBaseline(gp);
  cache.set(gp.id, baseline);
  return baseline;
}

async function inferBaseline(gp: GooglePlace): Promise<CachedBaseline> {
  const photos = (gp.photos ?? []).slice(0, 4).map((p) => placePhotoUrl(p.name));
  const reviewSnippets = (gp.reviews ?? [])
    .slice(0, 5)
    .map((r) => r.text?.text ?? r.originalText?.text ?? "")
    .filter(Boolean);
  const summary = gp.editorialSummary?.text ?? "";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const userParts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: [
        `Place: ${gp.displayName?.text ?? "unknown"}`,
        gp.formattedAddress ? `Address: ${gp.formattedAddress}` : "",
        summary ? `Editorial: ${summary}` : "",
        reviewSnippets.length
          ? `Reviews:\n- ${reviewSnippets.join("\n- ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    },
    ...photos.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];

  const resp = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      { role: "system", content: PLACE_BASELINE_PROMPT },
      { role: "user", content: userParts },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "VibeObject",
        schema: VIBE_OBJECT_SCHEMA,
        strict: true,
      },
    },
  });

  const content = resp.choices[0]?.message?.content ?? "{}";
  const draft = JSON.parse(content);

  let embedding: number[] | undefined;
  try {
    const e = await client.embeddings.create({
      model: EMBED_MODEL,
      input: vibeEmbedSource(draft),
    });
    embedding = e.data[0].embedding;
  } catch {
    // skip
  }

  return {
    id: `place-${gp.id}`,
    googlePlaceId: gp.id,
    source: { kind: "place_baseline", placeId: gp.id },
    title: draft.title,
    oneLiner: draft.oneLiner,
    palette: draft.palette,
    lighting: draft.lighting,
    spatial: draft.spatial,
    visualMotifs: draft.visualMotifs,
    density: draft.density,
    energy: draft.energy,
    timeOfDay: draft.timeOfDay,
    weatherImplied: draft.weatherImplied,
    soundscape: draft.soundscape,
    musicAnchor: draft.musicAnchor,
    moodTags: draft.moodTags,
    embedding,
    createdAt: Date.now(),
    cachedAt: Date.now(),
  };
}

function vibeEmbedSource(d: VibeObject): string {
  return [
    d.title,
    d.oneLiner,
    d.lighting,
    d.spatial,
    `palette: ${d.palette.map((p) => p.name).join(", ")}`,
    `motifs: ${d.visualMotifs.join(", ")}`,
    `soundscape: ${d.soundscape.join(", ")}`,
    `music: ${d.musicAnchor.genre} ${d.musicAnchor.tempoBpm}bpm`,
    `mood: ${d.moodTags.join(", ")}`,
    `time: ${d.timeOfDay}`,
  ].join("\n");
}

// ---------- "Why this matches" generation ----------

async function generateWhy(query: VibeObject, place: VibeObject): Promise<string> {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await client.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write one sentence explaining why a real place matches a queried vibe. Name two specific concrete anchors (a sound, a color, a motif). No hedging. No 'this place'. Editorial tone, like a small magazine.",
        },
        {
          role: "user",
          content: `Query vibe:\n${vibeEmbedSource(query)}\n\nPlace vibe:\n${vibeEmbedSource(place)}\n\nWrite the sentence.`,
        },
      ],
      max_tokens: 80,
      temperature: 0.7,
    });
    return resp.choices[0]?.message?.content?.trim() ?? place.oneLiner;
  } catch {
    return place.oneLiner;
  }
}

// ---------- Project to UI Place ----------

function projectToPlace(
  gp: GooglePlace,
  matchScore: number,
  why: string,
): Place {
  const photo = gp.photos?.[0]?.name
    ? placePhotoUrl(gp.photos[0].name, 1200)
    : "";
  const lat = gp.location?.latitude ?? VENUE_LAT;
  const lng = gp.location?.longitude ?? VENUE_LNG;
  const distanceMeters = haversine(VENUE_LAT, VENUE_LNG, lat, lng);
  const walkMinutes = Math.max(1, Math.round(distanceMeters / 80));

  const neighbourhood =
    extractNeighbourhood(gp.shortFormattedAddress ?? gp.formattedAddress ?? "") ??
    "nearby";

  const hours = gp.regularOpeningHours?.weekdayDescriptions?.[0] ?? "";

  return {
    id: gp.id,
    googlePlaceId: gp.id,
    name: gp.displayName?.text ?? "Unknown",
    address: gp.formattedAddress ?? "",
    neighbourhood,
    distanceMeters: Math.round(distanceMeters),
    walkMinutes,
    rating: gp.rating ?? 0,
    photoUrl: photo,
    matchScore,
    whyThisMatches: why,
    hours,
    openNow: gp.regularOpeningHours?.openNow,
    location: { lat, lng },
  };
}

function extractNeighbourhood(addr: string): string | null {
  const parts = addr.split(",").map((s) => s.trim());
  if (parts.length >= 2) return parts[parts.length - 2].toLowerCase();
  return null;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ---------- Cache hydration ----------

let cacheHydrated = false;
async function hydrateCache() {
  if (cacheHydrated) return;
  cacheHydrated = true;
  try {
    const stored = await loadPlaces();
    for (const [key, p] of Object.entries(stored)) {
      if (p.inferredVibeId && p.id) {
        // The stored place includes the inferred vibe id pointer.
        // Real baseline rehydration is deferred; for now we only cache
        // freshly computed baselines within the process.
        void key;
      }
    }
  } catch {
    // ignore
  }
}

async function persistCache() {
  try {
    const stored = await loadPlaces();
    cache.forEach((v, k) => {
      stored[k] = {
        id: k,
        googlePlaceId: k,
        name: v.title,
        address: "",
        neighbourhood: "",
        distanceMeters: 0,
        walkMinutes: 0,
        rating: 0,
        photoUrl: "",
        matchScore: 0,
        whyThisMatches: v.oneLiner,
        location: { lat: VENUE_LAT, lng: VENUE_LNG },
        inferredVibeId: v.id,
      };
    });
    await savePlaces(stored);
  } catch {
    // ignore
  }
}
