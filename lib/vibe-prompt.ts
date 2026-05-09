// The extraction system prompt for the vision model. Tuned to avoid the
// generic "a cafe with people" failure mode by demanding specificity at
// every facet. The constraint is the entire game.

export const VIBE_EXTRACTION_PROMPT = `
You are a sensory analyst for a magazine called Viber. You study the
atmosphere of a place captured on video. Not the events. Not the people
as individuals. The room and how it feels.

You will be given eight frames sampled at uniform intervals from a video.

Return a JSON object matching the VibeObject schema.

Hard rules:
- Be highly specific. Do not write "a cafe" or "people inside". Write what
  you actually see: "warm tungsten lights, exposed brick on the right wall,
  a barista pulling shots, four to five patrons reading or working".
- Music genre: be specific. Not "jazz" but "modal jazz, late" or "bossa
  nova, sparse". Not "electronic" but "ambient drone, slow attack".
- Soundscape: name the actual sounds in order of prominence, with cadence
  hints when relevant ("espresso machine, every 90s").
- Mood tags: 3 to 5 emotional descriptors a thoughtful curator would use.
  Avoid "vibey", "aesthetic", "cool", "lofi". Prefer concrete words:
  "focused", "introspective", "private", "communal", "sweaty", "patient".
- Palette: 3 to 4 colors with both a named descriptor AND a hex code.
- Density: estimate visible occupancy from 0 (empty) to 1 (packed).
- Energy: estimate from 0 (languid) to 1 (intense).
- Title: write a magazine cover title, like "A Tokyo Coffee Shop, Late
  Afternoon." Two clauses. Editorial tone.
- One-liner: a single sentence that names two specific sensory anchors.

Output strictly the JSON object. No prose before or after.
`.trim();

// JSON schema for OpenAI structured output, strict mode compatible.
// All properties must be required and additionalProperties must be false.
export const VIBE_OBJECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "oneLiner",
    "palette",
    "lighting",
    "spatial",
    "visualMotifs",
    "density",
    "energy",
    "timeOfDay",
    "weatherImplied",
    "soundscape",
    "musicAnchor",
    "moodTags",
  ],
  properties: {
    title: { type: "string" },
    oneLiner: { type: "string" },
    palette: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "hex"],
        properties: {
          name: { type: "string" },
          hex: { type: "string" },
        },
      },
    },
    lighting: { type: "string" },
    spatial: { type: "string" },
    visualMotifs: { type: "array", items: { type: "string" } },
    density: { type: "number" },
    energy: { type: "number" },
    timeOfDay: {
      type: "string",
      enum: ["morning", "midday", "afternoon", "evening", "late-night"],
    },
    weatherImplied: { type: "string" },
    soundscape: { type: "array", items: { type: "string" } },
    musicAnchor: {
      type: "object",
      additionalProperties: false,
      required: ["genre", "tempoBpm", "key", "referenceTrack"],
      properties: {
        genre: { type: "string" },
        tempoBpm: { type: "integer" },
        key: { type: "string" },
        referenceTrack: { type: "string" },
      },
    },
    moodTags: { type: "array", items: { type: "string" } },
  },
} as const;

export const PLACE_BASELINE_PROMPT = `
You are inferring the atmosphere of a real cafe from photos uploaded by
visitors and short text reviews. Same rules as the magazine analyst:
specificity over genericness. Same VibeObject schema. Photos may be of
food, drinks, exteriors, or interiors. Use the visual evidence and the
review snippets together. If a sound is not implied by either, do not
invent it.
`.trim();
