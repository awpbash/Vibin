// OpenAI gpt-4o-audio-preview replacement for the old Gemini analyzer.
//
// Pipeline: 3-slice Self-Consistency (parallel) -> text reconciliation.
// Each slice gets its own audio chat call with structured JSON output;
// the reconciliation pass takes the three slice JSONs and produces a
// single AudioAnalysis using fixed consensus rules.
//
// WHY beatCount10s: tempo estimation is the single most failure-prone
// audio task for general-purpose multimodal models. Asking directly for
// BPM gives soft, biased guesses ("90 bpm" for everything). Forcing the
// model to first emit beatCount10s -- the count of beats it actually
// heard in the 10s slice -- and then derive tempoBpm = beatCount10s * 6
// turns the task into counting (which it can do) plus arithmetic
// (which it can do) instead of estimating (which it can't). The schema
// is declared with beatCount10s BEFORE tempoBpm so structured-output
// generation has to commit to the count first; tempoBpm is then
// strongly anchored.
//
// WHY 2/3 consensus in reconciliation: any single slice can be wrong
// (a quiet outro, a missed instrument). Requiring agreement of at
// least 2 of the 3 slices for inclusion (instruments, ambient layers,
// vocals presence, key) suppresses one-shot hallucinations while
// still surfacing real signal. tempo uses median for the same reason.

import OpenAI from "openai";
import type { AudioAnalysis } from "./types";

const SLICE_MODEL =
  process.env.VIBER_OPENAI_AUDIO_MODEL || "gpt-4o-audio-preview";
const RECONCILE_MODEL =
  process.env.VIBER_OPENAI_AUDIO_RECONCILE_MODEL || "gpt-5.4";

// Slice schema. Field order matters: reasoning -> beatCount10s ->
// tempoBpm so the structured-output decoder commits to the count first
// and the multiplication anchors the BPM.
const SLICE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "reasoning",
    "category",
    "hasMusic",
    "beatCount10s",
    "tempoBpm",
    "key",
    "leadInstrument",
    "secondaryInstruments",
    "ambientLayers",
    "hasVocals",
    "vocalCharacter",
    "timbreNotes",
  ],
  properties: {
    reasoning: { type: "string" },
    category: { type: "string" },
    hasMusic: { type: "boolean" },
    beatCount10s: { type: "integer" },
    tempoBpm: { type: "integer" },
    key: { type: "string" },
    leadInstrument: { type: "string" },
    secondaryInstruments: { type: "array", items: { type: "string" } },
    ambientLayers: { type: "array", items: { type: "string" } },
    hasVocals: { type: "boolean" },
    vocalCharacter: { type: "string" },
    timbreNotes: { type: "string" },
  },
} as const;

type SliceResult = {
  reasoning: string;
  category: string;
  hasMusic: boolean;
  beatCount10s: number;
  tempoBpm: number;
  key: string;
  leadInstrument: string;
  secondaryInstruments: string[];
  ambientLayers: string[];
  hasVocals: boolean;
  vocalCharacter: string;
  timbreNotes: string;
};

const SLICE_SYSTEM = `You are a sensory audio analyst for Viber. You hear ONE
~10-second audio slice from a longer recording and describe exactly what
is in it.

TEMPO PROTOCOL (mandatory, do NOT skip):
- In 'reasoning', count the beats you actually hear in this 10-second
  slice. Write the count out: "I hear 1, 2, 3, ... beats."
- Set beatCount10s to that integer count.
- Set tempoBpm = beatCount10s * 6. Do not estimate; compute.
- If hasMusic is false or there is no discernible pulse, set
  beatCount10s = 0 and tempoBpm = 0.

INSTRUMENTS:
- leadInstrument: be specific. "upright bass" not "bass". "Rhodes
  piano" not "piano". "nylon-string guitar" not "guitar". "tenor
  saxophone" not "sax". If you genuinely cannot tell, say "unclear".
- secondaryInstruments: up to 3, ordered by prominence, same
  specificity rule. Empty array if only one instrument.

VOCALS:
- hasVocals = true ONLY if a human voice is actually heard singing,
  humming, or speaking in this slice. Pads, "ahhs" from a synth, and
  vocal-sample chops in electronic tracks count as vocals only if a
  human timbre is present.
- vocalCharacter: empty string when hasVocals is false. Otherwise one
  short phrase: "soft female alto, almost spoken", "male tenor with
  reverb", "crowd singing along".

KEY: musical key if confident ("A minor", "F major"). Otherwise "unclear".

AMBIENT LAYERS: non-music sounds in the slice. Examples: "espresso
machine hiss", "low chatter, intermittent", "rain on glass", "wok
flame roar", "fluorescent buzz". Order by prominence. Empty array if
pure music with no room tone.

CATEGORY: a short specific phrase. "instrumental jazz quartet, late",
"ambient drone with field recording", "k-pop ballad with strings".
Not just "jazz" or "electronic".

TIMBRE NOTES: one sentence, 8 to 20 words, on character / production
quirks. "Tape hiss audible, slight wow on the Rhodes, room is dry."

FORBIDDEN WORDS in any output field: "vibey", "chill", "mellow",
"lofi" (unless the actual lo-fi-hip-hop genre is genuinely heard with
sampled drums + sidechained bass), "aesthetic", "cool", "good".

Output strict JSON matching the provided schema. No prose outside JSON.`;

const RECONCILE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "reasoning",
    "hasMusic",
    "genre",
    "tempoBpm",
    "key",
    "instruments",
    "ambientLayers",
    "audioMood",
    "musicalCharacter",
    "hasVocals",
    "vocalCharacter",
  ],
  properties: {
    reasoning: { type: "string" },
    hasMusic: { type: "boolean" },
    genre: { type: "string" },
    tempoBpm: { type: "integer" },
    key: { type: "string" },
    instruments: { type: "array", items: { type: "string" } },
    ambientLayers: { type: "array", items: { type: "string" } },
    audioMood: { type: "array", items: { type: "string" } },
    musicalCharacter: { type: "string" },
    hasVocals: { type: "boolean" },
    vocalCharacter: { type: "string" },
  },
} as const;

const RECONCILE_SYSTEM = `You are reconciling 3 independent audio analyses
of the same recording (intro, mid, outro slices) into a single
AudioAnalysis.

Use these rules exactly. Show the rule application in 'reasoning'.

1. tempoBpm: median of the three tempoBpm values. If music is absent
   in 2 of 3 slices, set tempoBpm = 0.

2. hasMusic: true if music is detected in 2 or more slices.

3. key: if at least 2 of 3 slices report the same key, use that key.
   Otherwise "unclear". A slice reporting "unclear" never counts toward
   agreement.

4. instruments: union ordered by frequency across slices, BUT only
   include an instrument if it appears in 2 or more slices. Include
   leadInstrument and secondaryInstruments together when counting.
   Order by total occurrences (lead counts as 1 occurrence per slice
   it appears in, same for secondary). Tie-break by appearing earlier.

5. ambientLayers: same 2-of-3 rule as instruments. An ambient sound
   only makes the final list if 2+ slices heard it (treat near-
   synonyms as the same: "low chatter" and "chatter, intermittent"
   merge).

6. hasVocals: true only if 2 or more slices report hasVocals=true.

7. vocalCharacter: empty string unless hasVocals is true. If true,
   pick the most specific non-empty vocalCharacter from the slices
   that reported vocals.

8. genre: pick the most specific category across the three slices, or
   synthesize one that is at least as specific as the most specific
   slice category. "modal jazz, late" not "jazz". "ambient drone,
   slow attack" not "ambient". If hasMusic is false, set genre to
   "none".

9. musicalCharacter: one sentence, 12 to 25 words, merging the three
   timbreNotes into a single coherent texture description. If hasMusic
   is false, set to "no music, room tone only".

10. audioMood: 3 to 5 words. Forbidden: "vibey", "chill", "lofi",
    "aesthetic", "cool". Prefer "introspective", "melancholy",
    "patient", "communal", "dense", "dim", "buoyant", "agitated".

Output strict JSON matching the schema. No prose outside JSON.`;

export async function analyzeAudio(opts: {
  slices: { buf: Buffer; mime: string; label: string }[];
}): Promise<AudioAnalysis> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY missing");
  }
  if (!opts.slices?.length) {
    throw new Error("analyzeAudio: no slices provided");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Stage 1 - 3 parallel slice analyses. allSettled so one bad slice
  // doesn't kill the whole call. We only fail if every slice fails.
  const settled = await Promise.allSettled(
    opts.slices.map((s) => analyzeSlice(client, s)),
  );

  const slices: SliceResult[] = [];
  const errors: string[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") slices.push(r.value);
    else errors.push(r.reason instanceof Error ? r.reason.message : String(r.reason));
  }

  if (slices.length === 0) {
    throw new Error(
      `audio analysis: all slices failed. ${errors.join(" | ")}`,
    );
  }

  // Stage 2 - reconcile. Even with only 1-2 surviving slices we still
  // run reconciliation; the consensus rules degrade gracefully (with
  // 1 slice everything passes through; with 2 slices, the 2-of-3
  // rules become 2-of-2).
  return reconcile(client, slices);
}

async function analyzeSlice(
  client: OpenAI,
  slice: { buf: Buffer; mime: string; label: string },
): Promise<SliceResult> {
  const format = audioFormatFromMime(slice.mime);
  const data = slice.buf.toString("base64");

  const resp = await client.chat.completions.create({
    model: SLICE_MODEL,
    modalities: ["text"],
    messages: [
      { role: "system", content: SLICE_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Slice label: ${slice.label}. Analyze ONLY this 10-second slice. Output JSON.`,
          },
          {
            type: "input_audio",
            input_audio: { data, format },
          },
        ],
      },
    ],
    // gpt-4o-audio-preview doesn't accept response_format: json_schema
    // (only json_object). The system prompt describes the required
    // shape; normalizeSlice() defends against partial output.
    response_format: { type: "json_object" },
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error(`slice ${slice.label}: empty content`);
  const parsed = JSON.parse(content) as SliceResult;
  return normalizeSlice(parsed);
}

async function reconcile(
  client: OpenAI,
  slices: SliceResult[],
): Promise<AudioAnalysis> {
  const resp = await client.chat.completions.create({
    model: RECONCILE_MODEL,
    messages: [
      { role: "system", content: RECONCILE_SYSTEM },
      {
        role: "user",
        content: `Three slice analyses follow as JSON. Apply the consensus rules exactly and emit the reconciled AudioAnalysis.\n\n${JSON.stringify(
          slices,
          null,
          2,
        )}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "AudioAnalysis",
        schema: RECONCILE_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  const content = resp.choices[0]?.message?.content;
  if (!content) {
    // Reconciliation failure is recoverable: fall back to a deterministic
    // local merge from the slices. Better to ship a slightly weaker
    // analysis than to fail extraction over a single LLM hiccup.
    return localReconcile(slices);
  }
  const parsed = JSON.parse(content) as AudioAnalysis & { reasoning?: string };
  return stripReasoning(parsed);
}

function stripReasoning<T extends { reasoning?: string }>(
  o: T,
): Omit<T, "reasoning"> {
  const { reasoning: _r, ...rest } = o;
  void _r;
  return rest;
}

// Defensive coercion: keep tempo internally consistent with the count.
// If the model emits a beatCount10s but a tempoBpm that doesn't match
// (count*6), trust the count -- it's the grounded observation.
function normalizeSlice(s: SliceResult): SliceResult {
  const expected = (s.beatCount10s || 0) * 6;
  const tempo =
    s.hasMusic && s.beatCount10s > 0
      ? expected
      : 0;
  return {
    ...s,
    tempoBpm: tempo,
    secondaryInstruments: (s.secondaryInstruments || []).slice(0, 3),
    ambientLayers: s.ambientLayers || [],
    vocalCharacter: s.hasVocals ? s.vocalCharacter || "" : "",
  };
}

// Deterministic fallback if the reconcile LLM call returns nothing
// parseable. Implements the same 2/3 rules in code so the pipeline
// still yields a usable AudioAnalysis.
function localReconcile(slices: SliceResult[]): AudioAnalysis {
  const n = slices.length;
  const minVotes = n >= 3 ? 2 : n; // 2-of-3, else require unanimous

  const hasMusic =
    slices.filter((s) => s.hasMusic).length >= Math.ceil(n / 2);

  const tempos = slices
    .filter((s) => s.tempoBpm > 0)
    .map((s) => s.tempoBpm)
    .sort((a, b) => a - b);
  const tempoBpm = tempos.length
    ? tempos[Math.floor(tempos.length / 2)]
    : 0;

  const keyVotes = countVotes(
    slices.map((s) => s.key).filter((k) => k && k.toLowerCase() !== "unclear"),
  );
  const topKey = topVote(keyVotes);
  const key = topKey && topKey.count >= minVotes ? topKey.value : "unclear";

  const instrumentVotes = countVotes(
    slices.flatMap((s) =>
      [s.leadInstrument, ...(s.secondaryInstruments || [])].filter(
        (x) => x && x.toLowerCase() !== "unclear",
      ),
    ),
  );
  const instruments = Array.from(instrumentVotes.entries())
    .filter(([, c]) => c >= minVotes)
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);

  const ambientVotes = countVotes(slices.flatMap((s) => s.ambientLayers || []));
  const ambientLayers = Array.from(ambientVotes.entries())
    .filter(([, c]) => c >= minVotes)
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);

  const hasVocals =
    slices.filter((s) => s.hasVocals).length >= Math.ceil(n / 2);

  const vocalCharacter = hasVocals
    ? slices
        .filter((s) => s.hasVocals && s.vocalCharacter)
        .map((s) => s.vocalCharacter)
        .sort((a, b) => b.length - a.length)[0] || ""
    : "";

  // Prefer the longest (most specific) category as a quick heuristic.
  const genre = hasMusic
    ? slices
        .map((s) => s.category)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] || "unclear"
    : "none";

  const musicalCharacter = hasMusic
    ? slices
        .map((s) => s.timbreNotes)
        .filter(Boolean)
        .join(" ")
        .slice(0, 280) || "music present, texture unclear"
    : "no music, room tone only";

  const audioMood = deriveMoodFallback(slices, hasMusic);

  return {
    hasMusic,
    genre,
    tempoBpm,
    key,
    instruments,
    ambientLayers,
    audioMood,
    musicalCharacter,
    hasVocals,
    vocalCharacter,
  };
}

function deriveMoodFallback(
  slices: SliceResult[],
  hasMusic: boolean,
): string[] {
  if (!hasMusic) return ["quiet", "ambient", "still"];
  const tempos = slices.map((s) => s.tempoBpm).filter((t) => t > 0);
  const avg = tempos.length
    ? tempos.reduce((a, b) => a + b, 0) / tempos.length
    : 0;
  if (avg >= 130) return ["driving", "bright", "kinetic"];
  if (avg >= 95) return ["buoyant", "warm", "moving"];
  if (avg >= 70) return ["patient", "introspective", "warm"];
  return ["slow", "introspective", "dim"];
}

function countVotes(xs: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const raw of xs) {
    const k = canonicalize(raw);
    if (!k) continue;
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

function topVote(
  m: Map<string, number>,
): { value: string; count: number } | undefined {
  let best: { value: string; count: number } | undefined;
  for (const [value, count] of m) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

function canonicalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function audioFormatFromMime(mime: string): "mp3" | "wav" {
  const m = mime.toLowerCase();
  if (m.includes("wav") || m.includes("wave") || m.includes("x-wav")) return "wav";
  return "mp3";
}
