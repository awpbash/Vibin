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

  generatedAssets?: {
    previewVideoUrl?: string;
    musicUrl?: string;
  };

  createdAt: number;
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
