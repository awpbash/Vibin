// Hardcoded fallback vibes the FieldMap pins point to. Loaded into the
// in-memory store at hydrate time so the demo always has something to
// render — even on a cold Vercel function with an empty DB. Replaced
// transparently by any matching id present in storage.

import type { VibeObject } from "./types";

const TOKYO_COFFEE: VibeObject = {
  id: "tokyo-coffee",
  source: {
    kind: "youtube",
    url: "https://www.youtube.com/watch?v=mPZkdNFkNps",
    title: "Tokyo Coffee Shop, Late Afternoon",
    previewUrl: "https://www.youtube.com/embed/mPZkdNFkNps",
    durationSeconds: 240,
  },
  title: "Forty Hands, Late Afternoon",
  oneLiner:
    "Warm tungsten light, exposed brick on the right wall, a barista pulling shots while four patrons read.",
  palette: [
    { name: "warm tungsten", hex: "#d8a558" },
    { name: "muted greens", hex: "#7c8c63" },
    { name: "exposed brick", hex: "#8a4a35" },
    { name: "cream paper", hex: "#ece3d2" },
  ],
  lighting:
    "Low-angle tungsten pendants over the bar, soft afternoon spill through one tall window with leaves tracing across the glass.",
  spatial:
    "A narrow shopfront café, exposed brick on the right, dark walnut bar along the left, four small tables in the middle, espresso machine humming in the background.",
  visualMotifs: [
    "warm tungsten pendant lamps",
    "exposed brick wall, mortar visible",
    "barista pulling shots, steam rising",
    "open notebooks and ceramic cups",
    "leaves in the window",
  ],
  density: 0.55,
  energy: 0.35,
  timeOfDay: "afternoon",
  weatherImplied: "soft overcast outside, warm interior",
  soundscape: [
    "espresso machine hiss",
    "low chatter, intermittent",
    "ceramic cups on saucers",
    "bossa nova through small speakers",
    "rain on glass, faint",
  ],
  musicAnchor: {
    genre: "bossa nova, instrumental",
    tempoBpm: 92,
    key: "F major",
    referenceTrack: "Antônio Carlos Jobim — Wave",
  },
  moodTags: ["warm", "patient", "introspective", "soft", "studious"],
  audioAnalysis: {
    hasMusic: true,
    genre: "bossa nova, instrumental",
    tempoBpm: 92,
    key: "F major",
    instruments: ["nylon-string guitar", "upright bass", "brushed snare"],
    ambientLayers: ["espresso machine hiss", "low chatter, intermittent"],
    audioMood: ["warm", "patient", "introspective"],
    musicalCharacter:
      "Soft bossa with brushed drums, nylon guitar arpeggios, and an upright bass line; tape hiss audible underneath.",
    hasVocals: false,
    vocalCharacter: "",
  },
  createdAt: Date.parse("2026-05-01T15:30:00Z"),
};

const LISBON_JAZZ: VibeObject = {
  id: "lisbon-jazz",
  source: {
    kind: "youtube",
    url: "https://www.youtube.com/watch?v=bUfHBuDHxlc",
    title: "Lisbon Jazz Bar, Past Midnight",
    previewUrl: "https://www.youtube.com/embed/bUfHBuDHxlc",
    durationSeconds: 320,
  },
  title: "Maduro, Past Midnight",
  oneLiner:
    "Candlelit zinc bar, a Rhodes piano under a low ceiling, half-empty glasses catching the amber light.",
  palette: [
    { name: "candle amber", hex: "#c2842c" },
    { name: "deep oxblood", hex: "#5a1f1d" },
    { name: "smoke charcoal", hex: "#2a2622" },
    { name: "brass glow", hex: "#a3823a" },
  ],
  lighting:
    "Candles on every table, one weak overhead pendant by the bar, the rest of the room receding into deep amber darkness.",
  spatial:
    "Low-ceilinged jazz bar, dark wood paneling, a small four-person stage in the corner with a Rhodes and an upright bass; the bar is zinc, the floor is checkerboard.",
  visualMotifs: [
    "candle flames in red glass holders",
    "Rhodes piano on a small corner stage",
    "zinc-topped bar, half-empty glasses",
    "smoke curling under low ceiling",
    "checkerboard tile floor",
  ],
  density: 0.65,
  energy: 0.45,
  timeOfDay: "late-night",
  weatherImplied: "cool damp street outside",
  soundscape: [
    "Rhodes chord trailing into reverb",
    "brushed cymbals, slow",
    "low conversation in Portuguese",
    "ice in glasses",
    "footsteps on tile, occasional",
  ],
  musicAnchor: {
    genre: "modal jazz, late-night quartet",
    tempoBpm: 76,
    key: "D minor",
    referenceTrack: "Bill Evans — Peace Piece",
  },
  moodTags: ["smoky", "intimate", "melancholy", "slow", "amber"],
  audioAnalysis: {
    hasMusic: true,
    genre: "modal jazz, late-night quartet",
    tempoBpm: 76,
    key: "D minor",
    instruments: ["Rhodes piano", "upright bass", "brushed drums", "tenor saxophone"],
    ambientLayers: ["low conversation", "ice in glasses"],
    audioMood: ["intimate", "melancholy", "amber"],
    musicalCharacter:
      "Sparse Rhodes voicings, walking upright bass, brushed drums, an occasional tenor sax phrase that ends in held breath.",
    hasVocals: false,
    vocalCharacter: "",
  },
  createdAt: Date.parse("2026-05-01T15:31:00Z"),
};

const MIDNIGHT_HAWKER: VibeObject = {
  id: "midnight-hawker",
  source: {
    kind: "youtube",
    url: "https://www.youtube.com/watch?v=N_RhUk4ZrFQ",
    title: "Maxwell Hawker, Communal Tables",
    previewUrl: "https://www.youtube.com/embed/N_RhUk4ZrFQ",
    durationSeconds: 180,
  },
  title: "Maxwell Centre, Wok Smoke",
  oneLiner:
    "Fluorescent tubes overhead, wok flame roar from stall four, communal steel tables packed shoulder to shoulder.",
  palette: [
    { name: "fluorescent white", hex: "#e8e9d9" },
    { name: "wok char", hex: "#1f1a14" },
    { name: "stall red", hex: "#b8472b" },
    { name: "steel grey", hex: "#9aa1a3" },
  ],
  lighting:
    "Hard fluorescent tubes covering the ceiling, painting everything a slightly green-white; stall signs glow red and yellow underneath.",
  spatial:
    "Open-sided hawker centre, rows of communal stainless tables, dozens of stalls along the edges with hand-painted signs, woks visible through every counter.",
  visualMotifs: [
    "fluorescent tube ceiling",
    "wok flames at stall four",
    "stainless communal tables",
    "hand-painted bilingual signs",
    "plastic stools and steel chopsticks",
  ],
  density: 0.92,
  energy: 0.78,
  timeOfDay: "late-night",
  weatherImplied: "warm humid night, ceiling fans on",
  soundscape: [
    "wok flame roar, intermittent",
    "metal spatula on steel wok",
    "communal chatter, dense",
    "plastic stool legs scraping",
    "ceiling fan whir",
  ],
  musicAnchor: {
    genre: "ambient hawker — no music, just room",
    tempoBpm: 0,
    key: "unclear",
    referenceTrack: "",
  },
  moodTags: ["communal", "hot", "kinetic", "loud", "alive"],
  audioAnalysis: {
    hasMusic: false,
    genre: "none",
    tempoBpm: 0,
    key: "unclear",
    instruments: [],
    ambientLayers: [
      "wok flame roar",
      "metal on steel wok",
      "dense communal chatter",
      "ceiling fan whir",
    ],
    audioMood: ["communal", "kinetic", "loud"],
    musicalCharacter: "no music, room tone only",
    hasVocals: false,
    vocalCharacter: "",
  },
  createdAt: Date.parse("2026-05-01T15:32:00Z"),
};

export const FIXTURE_VIBES: Record<string, VibeObject> = {
  "tokyo-coffee": TOKYO_COFFEE,
  "lisbon-jazz": LISBON_JAZZ,
  "midnight-hawker": MIDNIGHT_HAWKER,
};
