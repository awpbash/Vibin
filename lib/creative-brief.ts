// Builds a single coherent creative brief from a VibeObject. One LLM
// call → one shared "subject" paragraph + 3 still framings + a hero
// shot for Veo + a music prompt for ElevenLabs. All four downstream
// generators cite the same brief, so the renders look like the same
// imagined place from different angles instead of three drifting cafes.
//
// Cost: gpt-4o-mini, ~500 output tokens ≈ $0.0003 per call.

import OpenAI from "openai";
import type { CreativeBrief, VibeObject } from "./types";

const MODEL = process.env.VIBER_BRIEF_MODEL || "gpt-5.4";

const BRIEF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "subject",
    "shots",
    "heroShot",
    "musicPrompt",
    "hasVocals",
    "lyrics",
  ],
  properties: {
    subject: { type: "string" },
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
    heroShot: {
      type: "object",
      additionalProperties: false,
      required: ["description", "motion"],
      properties: {
        description: { type: "string" },
        motion: { type: "string" },
      },
    },
    musicPrompt: { type: "string" },
    hasVocals: { type: "boolean" },
    lyrics: { type: "string" },
  },
} as const;

const SYSTEM = `You are a creative director on Viber, a magazine that finds
real places by their atmosphere. You will be given a VibeObject extracted
from a short video. Your job is to write ONE tight creative brief that
will be sent to four different generators (3 image stills, 1 video clip,
1 music generator). Coherence is everything: every output must feel like
it captures the same imagined moment, the same place, the same hour.

Output rules:

- "subject" — one paragraph, 60 to 90 words. Describe ONE specific
  imagined scene, not a montage. Include 2 or 3 concrete props (e.g.
  "a half-finished cortado in a cream-rim ceramic cup, an open notebook
  with a black ink pen, a single pendant lamp"). Honour the lighting,
  palette, and timeOfDay from the VibeObject. Do not invent music; the
  music prompt is separate. No people as named characters.

- "shots" — exactly 3 items. Each is a distinct CAMERA FRAMING of the
  same subject. Use angle words like: "wide establishing", "tight detail
  on hands", "through doorway", "low-angle table", "over-the-shoulder",
  "looking up at ceiling". Every shot description MUST cite at least one
  specific element from the subject so the renders stay coherent.

  CRITICAL: each shot description must also state CLEARLY what is moving
  and alive in the frame for the full 8 seconds. This is documentary
  footage of a real place, NOT a composed still life. Examples of
  good per-shot motion you can write:
    "a barista pulling espresso shots, hands wiping the portafilter,
     steam rising from the milk pitcher continuously"
    "wind moves through the leaves outside the window, three pedestrians
     cross the foreground at different paces, traffic blurs past behind"
    "two patrons in conversation at the next table, one gesturing with
     a paper cup, the other turning a page; a server crosses behind
     them mid-shot"
  Bad examples (avoid): "a still cup of coffee", "a quiet table",
  "a peaceful empty corner".

- "heroShot" — the master shot for an 8-second video clip. Description
  cites the subject. The "motion" field must describe REAL CONTINUOUS
  ACTIVITY across the full 8 seconds, not a single momentary detail.
  Good motion examples:
    "the barista pulls two espresso shots, steams milk, then pours a
     latte; a customer waits at the counter; foot traffic passes the
     window throughout"
    "a busy lunchtime hawker stall: the cook tosses noodles in a wok
     with visible flame, plates dishes, hands them to two waiting
     patrons; queue visible behind"
    "a quiet park bench scene: leaves sway in steady breeze, a jogger
     passes left to right at second 3, a couple walks past slowly in
     the distance, light dapples through the canopy"
  Avoid single-moment motion like "steam rises". The frame must feel
  alive for the entire shot. Camera can be locked off or drift slowly,
  but the SUBJECT must be active.

- "hasVocals" — boolean. Set true ONLY when one of these holds:
  (a) audio analysis explicitly identified vocals;
  (b) the place's character strongly implies sung music as part of the
      atmosphere (e.g., a Lisbon fado bar, a smoky jazz lounge with a
      vocalist, an indie cafe known for folk records, a karaoke room).
  Set false for everything else: study cafes, hawker centres, focused
  work environments, gym-adjacent ambient. When in doubt, prefer false.

- "lyrics" — when hasVocals is true, write 6 to 12 lines of original
  lyrics that capture the imagined scene's mood. Use [Verse 1] /
  [Chorus] / [Verse 2] section tags exactly like that, on their own
  lines. Tasteful, no profanity, no political content, no real names
  or trademarks. Match the language and register of the place
  (a Lisbon fado bar gets Portuguese-inflected English fine, a Tokyo
  cafe stays understated). When hasVocals is false, return the empty
  string "".

- "musicPrompt" — for ElevenLabs Music. This is the single most
  important field and it must be richly structured. The output target
  is a 90-second piece that feels cohesive with the source recording,
  not a stock loop.

  WRITE THE PROMPT IN FOUR LABELLED SECTIONS, in this exact order:

    [REFERENCE FROM SOURCE]
    Anchor the piece on the audio analysis if provided. State, in
    one line each:
      Genre: <audio.genre, or vibe musicAnchor.genre as fallback>
      Tempo: <audio.tempoBpm bpm — exact number>
      Key: <audio.key, or "modal, drifting" if unclear>
      Lead instruments (in order of prominence): <comma list, the
        actual specific instruments from audio.instruments — e.g.
        "upright bass, brushed snare, muted trumpet">
      Texture: <one short sentence, ideally lifted from
        audio.musicalCharacter — e.g. "sparse Rhodes over a soft
        tape hiss, single bass note held">

    [STRUCTURE — 90 seconds]
    Lay out time-stamped sections. Use this template, filling in
    instruments and dynamics from the source palette:
      0:00–0:15 Intro: solo <primary inst>, very quiet, no rhythm
        section yet. Establish the key.
      0:15–0:45 Body: <secondary inst> joins. Sparse, breath between
        phrases. Hold the tempo steady.
      0:45–1:15 Development: harmonic motion, brief modal substitutions,
        <tertiary inst> adds colour for 4 to 8 bars then recedes.
      1:15–1:30 Outro: simplifies back to <primary inst>, decays into
        the room — <one ambientLayer from soundscape, e.g. "espresso
        machine hiss" or "rain on glass"> hints in the final 4 seconds.

    [ROOM CONTEXT]
    One sentence citing the imagined scene's time of day and mood so
    the music reads as belonging to that exact place. Reference 1-2
    moodTags (e.g. "introspective, patient").

    [RULES]
    - Never repeat the same melodic motif twice. Each section must
      develop the previous one.
    - Leave breathing space between phrases. 1-2 second pauses are
      good. No wall-of-sound.
    - Strictly no build to chorus or climax. This is ambient, not pop.
    - Stay in the same key throughout; modal substitutions OK.
    - When hasVocals is true: embed the lyrics inline using the exact
      [Verse]/[Chorus] section tags from the lyrics field, place them
      inside the appropriate STRUCTURE timestamps, and describe the
      vocal style in one short clause (timbre, gender, delivery).
    - When hasVocals is false: include the literal phrase
      "Instrumental, no vocals." in the [RULES] section.
    - Forbidden words anywhere in the prompt: trap, drill, gym,
      workout, fight, combat, gun.

  Total length 180 to 350 words. Use newlines between sections and
  inside structure. Plain text, no JSON inside the string.

Output strict JSON. No prose before or after.`;

export async function buildCreativeBrief(
  vibe: VibeObject,
): Promise<CreativeBrief> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const facts = JSON.stringify(
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
      audio: vibe.audioAnalysis,
    },
    null,
    2,
  );

  const resp = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `VibeObject:\n${facts}\n\nReturn the brief as strict JSON.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "CreativeBrief",
        schema: BRIEF_SCHEMA,
        strict: true,
      },
    },
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error("creative brief: empty content");
  return JSON.parse(content) as CreativeBrief;
}
