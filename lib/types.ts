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

// Output of Gemini 2.5 Flash audio analysis. The musical fields override
// the vision-guessed musicAnchor when hasMusic is true.
export type AudioAnalysis = {
  hasMusic: boolean;
  genre: string;
  tempoBpm: number;
  key: string;
  instruments: string[];
  ambientLayers: string[];      // non-music room sounds heard
  audioMood: string[];
  musicalCharacter: string;     // free-text descriptor: "sparse vibraphone over tape hiss"
};

// One LLM call produces this brief once per vibe. It is the shared
// reference all four generators (3 stills, Veo, ElevenLabs) cite, so
// the renders look like the same place from different angles.
export type CreativeBrief = {
  subject: string;              // one paragraph, the imagined scene
  shots: { angle: string; description: string }[];   // exactly 3
  heroShot: { description: string; motion: string }; // for the Veo clip
  musicPrompt: string;          // ElevenLabs-friendly, ToS-soft
  hasVocals: boolean;           // true only when source/mood implies sung music
  lyrics: string;               // [Verse]/[Chorus] structure when hasVocals, else ""
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
