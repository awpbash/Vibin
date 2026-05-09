export type TimeOfDay =
  | "morning"
  | "midday"
  | "afternoon"
  | "evening"
  | "late-night";

export type VibeObject = {
  id: string;
  source: {
    kind: "youtube" | "capture" | "place_baseline";
    url?: string;
    title?: string;
    placeId?: string;
    previewUrl?: string;       // playable url for the source clip
    audioSampleUrl?: string;   // persisted 30s mp3 used for analysis
    contentType?: string;      // mime, e.g. video/mp4
    durationSeconds?: number;
  };
  title: string;
  oneLiner: string;

  palette: { name: string; hex: string }[];
  lighting: string;
  spatial: string;
  visualMotifs: string[];

  density: number;
  energy: number;
  timeOfDay: TimeOfDay;
  weatherImplied?: string;

  soundscape: string[];
  musicAnchor: {
    genre: string;
    tempoBpm: number;
    key?: string;
    referenceTrack?: string;
  };

  moodTags: string[];

  embedding?: number[];

  audioAnalysis?: AudioAnalysis;
  creativeBrief?: CreativeBrief;

  generatedAssets?: {
    previewVideoUrl?: string;
    musicUrl?: string;
    musicPrompt?: string;
    musicDurationMs?: number;
    videoDurationSeconds?: number;
  };

  createdAt: number;
};

// Output of GPT-4o audio analysis (3-slice self-consistency, then text
// reconciliation). The musical fields override the vision-guessed
// musicAnchor when hasMusic is true.
export type AudioAnalysis = {
  hasMusic: boolean;
  genre: string;
  tempoBpm: number;
  key: string;
  instruments: string[];
  ambientLayers: string[];      // non-music room sounds heard
  audioMood: string[];
  musicalCharacter: string;     // free-text descriptor: "sparse vibraphone over tape hiss"
  hasVocals?: boolean;
  vocalCharacter?: string;      // "soft female alto, almost spoken" when hasVocals
};

// Built by a 7-stage least-to-most pipeline (creative-brief.ts). Each
// stage carries forward prior outputs so the renders all cite the same
// imagined scene. The chainPrompts field drives the 4-clip Veo chain so
// continuity is owned by ONE LLM reasoning pass, not assembled at video
// time from drifting fragments.
export type CreativeBrief = {
  subject: string;              // one paragraph, the imagined scene
  shots: { angle: string; description: string }[];   // exactly 3
  heroShot: { description: string; motion: string }; // for the Veo clip
  musicPrompt: string;          // ElevenLabs-friendly, ToS-soft
  hasVocals: boolean;           // true only when source/mood implies sung music
  vocalCharacter?: string;      // "soft female alto, almost spoken"
  lyrics: string;               // [Verse]/[Chorus] structure when hasVocals, else ""
  chainPrompts?: string[];      // 4 prompts for the Veo first/last-frame chain
};

export type Place = {
  id: string;
  googlePlaceId?: string;
  name: string;
  address: string;
  neighbourhood: string;
  distanceMeters: number;
  walkMinutes: number;
  rating: number;
  photoUrl: string;
  matchScore: number;
  whyThisMatches: string;
  hours?: string;
  openNow?: boolean;
  location: { lat: number; lng: number };
};
