// Least-to-most prompt chain that builds ONE coherent creative brief
// from a VibeObject. Seven sequential JSON-schema calls, each carrying
// every prior stage forward, so the four downstream generators (3 stills,
// 1 hero clip, 1 music piece, 4-clip Veo chain) all cite the same
// imagined moment instead of drifting. Every schema starts with a `plan`
// string for guided CoT — the model reasons inside the structured
// response itself, never as free-form prose.

import OpenAI from "openai";
import type { AudioAnalysis, CreativeBrief, VibeObject } from "./types";

const MODEL = process.env.VIBER_BRIEF_MODEL || "gpt-5.4";
const LIGHT_MODEL = "gpt-4o-mini";

const PROMPT_BLOCKLIST = [
  /\btrap\b/gi,
  /\bdrill\b/gi,
  /\bgym\b/gi,
  /\bworkout\b/gi,
  /\bfight\b/gi,
  /\bcombat\b/gi,
  /\bgun\b/gi,
];

function softenPrompt(s: string): string {
  let out = s;
  for (const re of PROMPT_BLOCKLIST) out = out.replace(re, "");
  return out.replace(/\s{2,}/g, " ").replace(/\s,/g, ",").trim();
}

function vibeFacts(vibe: VibeObject): string {
  return JSON.stringify(
    {
      title: vibe.title,
      oneLiner: vibe.oneLiner,
      palette: vibe.palette,
      lighting: vibe.lighting,
      spatial: vibe.spatial,
      visualMotifs: vibe.visualMotifs,
      timeOfDay: vibe.timeOfDay,
      density: vibe.density,
      energy: vibe.energy,
      weatherImplied: vibe.weatherImplied,
      soundscape: vibe.soundscape,
      musicAnchor: vibe.musicAnchor,
      moodTags: vibe.moodTags,
      audioAnalysis: vibe.audioAnalysis ?? null,
    },
    null,
    2,
  );
}

type ChatClient = OpenAI;

async function callJson<T>(
  client: ChatClient,
  model: string,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, schema, strict: true },
    },
  });
  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error(`creative brief ${schemaName}: empty content`);
  return JSON.parse(content) as T;
}

// ---------- Stage 1: SUBJECT ----------

const SUBJECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "subject"],
  properties: {
    plan: { type: "string" },
    subject: { type: "string" },
  },
} as const;

const SUBJECT_SYSTEM = `You are a creative director on Viber, a magazine that
finds real places by their atmosphere. You are starting a 7-stage brief.

Stage 1 — SUBJECT.

Output two fields:
- "plan": 1-3 short sentences. Note which palette, lighting, and timeOfDay
  cues from the VibeObject you will honour, and the 2-3 concrete props you
  will pick (e.g. "a half-finished cortado in a cream-rim ceramic cup, an
  open notebook with a black ink pen, a single pendant lamp"). This is
  scratch reasoning, not prose.
- "subject": ONE paragraph, 60 to 90 words, describing ONE specific
  imagined scene. Not a montage. Include the 2-3 concrete props you
  planned. Honour palette, lighting, and timeOfDay literally. No people
  as named characters. Do not invent music — the music prompt is later.

Strict JSON. No prose before or after.`;

async function runSubject(
  client: ChatClient,
  vibe: VibeObject,
): Promise<{ plan: string; subject: string }> {
  return callJson(
    client,
    MODEL,
    SUBJECT_SYSTEM,
    `VibeObject:\n${vibeFacts(vibe)}`,
    "Subject",
    SUBJECT_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Stage 2: SHOTS ----------

const SHOTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "shots"],
  properties: {
    plan: { type: "string" },
    shots: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["angle", "description"],
        properties: {
          angle: { type: "string" },
          description: { type: "string" },
        },
      },
    },
  },
} as const;

const SHOTS_SYSTEM = `Stage 2 — SHOTS.

You will receive the VibeObject and the subject paragraph from stage 1.
Output exactly 3 distinct camera framings of the SAME subject.

Fields:
- "plan": 1-3 sentences. Note the 3 angles you will pick (e.g. "wide
  establishing", "tight detail on hands", "through doorway", "low-angle
  table", "over-the-shoulder", "looking up at ceiling") and which noun
  phrase from the subject paragraph each shot will reuse verbatim.
- "shots": exactly 3 items. Each has:
    "angle": short framing label.
    "description": one sentence. RULE: every description MUST contain at
      least one noun phrase copied VERBATIM from the subject paragraph
      (e.g. if subject says "a cream-rim ceramic cup", the shot must say
      "a cream-rim ceramic cup", not "a ceramic mug"). Each description
      must also state what is moving and alive in the frame for the full
      8 seconds — this is documentary footage, not still life. Avoid
      "a still cup" or "a quiet empty corner".

Strict JSON. No prose.`;

async function runShots(
  client: ChatClient,
  vibe: VibeObject,
  subject: string,
): Promise<{
  plan: string;
  shots: { angle: string; description: string }[];
}> {
  return callJson(
    client,
    MODEL,
    SHOTS_SYSTEM,
    `VibeObject:\n${vibeFacts(vibe)}\n\nSubject (stage 1):\n${subject}`,
    "Shots",
    SHOTS_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Stage 3: HERO ----------

const HERO_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "heroShot"],
  properties: {
    plan: { type: "string" },
    heroShot: {
      type: "object",
      additionalProperties: false,
      required: ["description", "motion"],
      properties: {
        description: { type: "string" },
        motion: { type: "string" },
      },
    },
  },
} as const;

const HERO_SYSTEM = `Stage 3 — HERO SHOT.

You will receive the VibeObject, the subject paragraph, and the 3 shots.
Pick ONE master framing for an 8-second video clip. It can echo one of
the 3 shots or stand on its own.

Fields:
- "plan": 1-3 sentences. Sketch the 3+ timestamped events you will use
  across the 8 seconds and which props from the subject they involve.
- "heroShot.description": one sentence describing the locked framing.
  Cite at least one noun phrase from the subject verbatim.
- "heroShot.motion": REQUIRED — at least 3 distinct timestamped events
  spanning the 8 seconds, semicolon-separated. Example:
    "0:01 the cup is placed on the table; 0:04 the pour begins; 0:07
     the pour finishes and steam rises"
  Bad: "steam rises" (one moment, not 3, no timestamps).

Strict JSON. No prose.`;

async function runHero(
  client: ChatClient,
  vibe: VibeObject,
  subject: string,
  shots: { angle: string; description: string }[],
): Promise<{
  plan: string;
  heroShot: { description: string; motion: string };
}> {
  return callJson(
    client,
    MODEL,
    HERO_SYSTEM,
    `VibeObject:\n${vibeFacts(vibe)}\n\nSubject (stage 1):\n${subject}\n\nShots (stage 2):\n${JSON.stringify(
      shots,
      null,
      2,
    )}`,
    "Hero",
    HERO_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Stage 4: VOCAL DECISION ----------

const VOCAL_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "hasVocals", "vocalCharacter"],
  properties: {
    plan: { type: "string" },
    hasVocals: { type: "boolean" },
    vocalCharacter: { type: "string" },
  },
} as const;

const VOCAL_SYSTEM = `Stage 4 — VOCAL DECISION.

Decide whether the brief should include sung lyrics. Set hasVocals=true
ONLY when:
  (a) audioAnalysis.hasVocals is true, OR
  (b) the place's character STRONGLY implies sung music as part of the
      atmosphere — Lisbon fado bar, smoky jazz lounge with a vocalist,
      indie cafe known for folk records, candlelit listening room.
For everything else (study cafes, hawker centres, focused work spaces,
gym-adjacent ambient) set hasVocals=false. WHEN IN DOUBT, FALSE.

Fields:
- "plan": 1-3 sentences. State which signals you weighed (audioAnalysis,
  moodTags, spatial) and your verdict.
- "hasVocals": boolean.
- "vocalCharacter": short descriptor when hasVocals is true (e.g. "soft
  female alto, almost spoken, intimate"). EMPTY STRING "" when false.

Strict JSON.`;

async function runVocalDecision(
  client: ChatClient,
  vibe: VibeObject,
  subject: string,
): Promise<{ plan: string; hasVocals: boolean; vocalCharacter: string }> {
  return callJson(
    client,
    LIGHT_MODEL,
    VOCAL_SYSTEM,
    `VibeObject (focus on audioAnalysis, moodTags, spatial):\n${vibeFacts(
      vibe,
    )}\n\nSubject (stage 1):\n${subject}`,
    "VocalDecision",
    VOCAL_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Stage 5: LYRICS ----------

const LYRICS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "lyrics"],
  properties: {
    plan: { type: "string" },
    lyrics: { type: "string" },
  },
} as const;

const LYRICS_SYSTEM = `Stage 5 — LYRICS.

You only run when hasVocals is true. Write 6 to 12 lines of original
lyrics that capture the imagined scene's mood.

Fields:
- "plan": 1-2 sentences. Note the section structure you will use.
- "lyrics": MUST use these exact section tags, each on its own line:
    [Verse 1]
    ...
    [Chorus]
    ...
    [Verse 2]
    ...
  Match the register of the place (a Lisbon fado bar gets
  Portuguese-inflected English, a Tokyo cafe stays understated).
  No profanity, no real names, no trademarks, no political content.

Strict JSON.`;

async function runLyrics(
  client: ChatClient,
  subject: string,
  vocalCharacter: string,
): Promise<{ plan: string; lyrics: string }> {
  return callJson(
    client,
    LIGHT_MODEL,
    LYRICS_SYSTEM,
    `Subject (stage 1):\n${subject}\n\nVocal character (stage 4):\n${vocalCharacter}`,
    "Lyrics",
    LYRICS_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Stage 6: MUSIC PROMPT ----------

const MUSIC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "musicPrompt"],
  properties: {
    plan: { type: "string" },
    musicPrompt: { type: "string" },
  },
} as const;

function buildMusicSystem(audio: AudioAnalysis | undefined): string {
  const referenceLine =
    audio && audio.hasMusic
      ? `Cite the source verbatim: tempo "${audio.tempoBpm} bpm" as an integer, key "${audio.key}", and the first 3 instruments "${(audio.instruments || []).slice(0, 3).join(", ")}". These three values MUST appear inside [REFERENCE FROM SOURCE].`
      : `audioAnalysis is missing or hasMusic=false. Inside [REFERENCE FROM SOURCE] write the literal phrase "[no source audio analysis]" — DO NOT hallucinate tempo, key, or instruments.`;

  return `Stage 6 — MUSIC PROMPT for ElevenLabs Music.

Plain text, four labelled sections in this exact order, separated by
blank lines:

  [REFERENCE FROM SOURCE]
  ${referenceLine}
  Then: a one-line texture descriptor.

  [STRUCTURE — 90 seconds]
  Time-stamped sections:
    0:00–0:15 Intro: solo primary instrument, very quiet, no rhythm
      section, establish the key.
    0:15–0:45 Body: secondary instrument joins. Sparse, breath
      between phrases. Tempo steady.
    0:45–1:15 Development: harmonic motion, brief modal substitutions,
      tertiary instrument adds colour for 4-8 bars then recedes.
    1:15–1:30 Outro: simplifies back to primary, decays into the room
      with one ambientLayer hint in the final 4 seconds.

  [ROOM CONTEXT]
  One sentence citing the imagined scene's time of day and 1-2 moodTags.

  [RULES]
  - Never repeat the same melodic motif twice.
  - Leave 1-2 second pauses between phrases.
  - No build to chorus or climax. This is ambient, not pop.
  - Stay in the same key throughout; modal substitutions OK.
  - When hasVocals is true: embed the supplied lyrics inline using their
    [Verse]/[Chorus] tags inside the appropriate STRUCTURE timestamps,
    and describe the vocal style in one short clause using vocalCharacter.
  - When hasVocals is false: include the literal phrase
    "Instrumental, no vocals." in [RULES].
  - Forbidden words anywhere: trap, drill, gym, workout, fight, combat, gun.

Total length 180-350 words. Plain text, no JSON inside the string.

Output fields:
- "plan": 1-3 sentences naming the primary/secondary/tertiary instruments
  you will assign and the ambientLayer you will use in the outro.
- "musicPrompt": the four-section prompt above, as plain text.`;
}

async function runMusicPrompt(
  client: ChatClient,
  vibe: VibeObject,
  subject: string,
  lyrics: string,
  hasVocals: boolean,
  vocalCharacter: string,
): Promise<{ plan: string; musicPrompt: string }> {
  const audio = vibe.audioAnalysis;
  return callJson(
    client,
    MODEL,
    buildMusicSystem(audio),
    `VibeObject.audioAnalysis:\n${JSON.stringify(audio ?? null, null, 2)}\n\nSoundscape: ${JSON.stringify(vibe.soundscape)}\nMoodTags: ${JSON.stringify(vibe.moodTags)}\nTimeOfDay: ${vibe.timeOfDay}\nSpatial: ${vibe.spatial}\n\nSubject (stage 1):\n${subject}\n\nhasVocals (stage 4): ${hasVocals}\nvocalCharacter (stage 4): ${vocalCharacter || "(none)"}\n\nLyrics (stage 5):\n${lyrics || "(none — instrumental)"}`,
    "MusicPrompt",
    MUSIC_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Stage 7: CHAIN PROMPTS ----------

const CHAIN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "chainPrompts"],
  properties: {
    plan: { type: "string" },
    chainPrompts: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

const CHAIN_SYSTEM = `Stage 7 — CHAIN PROMPTS for the 4-clip Veo chain.

The chain renders 4 sequential 8-second clips that share continuity via
first/last-frame conditioning. Coherence is everything.

Fields:
- "plan": 2-4 sentences. Sketch the arc across the 4 clips: what is the
  SAME in every clip (location, framing, the 2 props you'll always
  restate verbatim) and what slowly SHIFTS over time (light, foot
  traffic, fullness of the cup, etc.).
- "chainPrompts": exactly 4 strings. Each prompt MUST:
    1. Restate the subject's location and 2 specific props verbatim.
    2. Reference the previous clip's ending state — e.g. "picking up
       where the milk has just finished steaming…". Clip 0 has no
       previous, so it is the hero opening.
    3. Name 3 motion events with rough timestamps, e.g.
       "0:02 cup placed; 0:04 pour begins; 0:07 pour finishes".
    4. END with the literal sentence:
       "Camera locked off. Documentary footage, not music video."

Strict JSON.`;

async function runChainPrompts(
  client: ChatClient,
  vibe: VibeObject,
  subject: string,
  heroShot: { description: string; motion: string },
  shots: { angle: string; description: string }[],
): Promise<{ plan: string; chainPrompts: string[] }> {
  return callJson(
    client,
    MODEL,
    CHAIN_SYSTEM,
    `VibeObject:\n${vibeFacts(vibe)}\n\nSubject (stage 1):\n${subject}\n\nHero (stage 3):\n${JSON.stringify(
      heroShot,
      null,
      2,
    )}\n\nShots (stage 2):\n${JSON.stringify(shots, null, 2)}`,
    "ChainPrompts",
    CHAIN_SCHEMA as unknown as Record<string, unknown>,
  );
}

// ---------- Orchestrator ----------

export async function buildCreativeBrief(
  vibe: VibeObject,
): Promise<CreativeBrief> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Sequential — every stage depends on prior outputs.
  const s1 = await runSubject(client, vibe);
  const subject = s1.subject.trim();

  const s2 = await runShots(client, vibe, subject);
  const shots = s2.shots.slice(0, 3);

  const s3 = await runHero(client, vibe, subject, shots);
  const heroShot = s3.heroShot;

  const s4 = await runVocalDecision(client, vibe, subject);
  const hasVocals = s4.hasVocals;
  const vocalCharacter = hasVocals ? (s4.vocalCharacter || "").trim() : "";

  let lyrics = "";
  if (hasVocals) {
    const s5 = await runLyrics(client, subject, vocalCharacter);
    lyrics = s5.lyrics.trim();
  }

  const s6 = await runMusicPrompt(
    client,
    vibe,
    subject,
    lyrics,
    hasVocals,
    vocalCharacter,
  );
  const musicPrompt = softenPrompt(s6.musicPrompt);

  const s7 = await runChainPrompts(client, vibe, subject, heroShot, shots);
  const chainPrompts = s7.chainPrompts.slice(0, 4);

  return {
    subject,
    shots,
    heroShot,
    hasVocals,
    vocalCharacter,
    lyrics,
    musicPrompt,
    chainPrompts,
  };
}
