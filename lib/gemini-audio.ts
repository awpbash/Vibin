// Gemini 3 Flash Preview audio understanding. Sends a short audio clip
// inline and asks for a strict-JSON breakdown of music + ambient room
// sounds.
//
// Cost (May 2026): Gemini 3 Flash audio is ~$0.30 / M input tokens.
// Audio is ~32 tokens/sec, so 30s ≈ 960 tokens ≈ $0.0003 per call.

import type { AudioAnalysis } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.VIBER_GEMINI_AUDIO_MODEL || "gemini-3-flash-preview";

const AUDIO_SCHEMA = {
  type: "object",
  required: [
    "hasMusic",
    "genre",
    "tempoBpm",
    "key",
    "instruments",
    "ambientLayers",
    "audioMood",
    "musicalCharacter",
  ],
  properties: {
    hasMusic: { type: "boolean" },
    genre: { type: "string" },
    tempoBpm: { type: "integer" },
    key: { type: "string" },
    instruments: { type: "array", items: { type: "string" } },
    ambientLayers: { type: "array", items: { type: "string" } },
    audioMood: { type: "array", items: { type: "string" } },
    musicalCharacter: { type: "string" },
  },
};

const SYSTEM = `You are a sensory analyst for Viber. You listen to a short
audio clip recorded in or for a place and describe exactly what you hear.

Hard rules:
- hasMusic: true if any musical content is detectable, else false.
- If hasMusic is false: set genre to "none", tempoBpm to 0, key to "none",
  instruments to [], musicalCharacter to "no music, room tone only".
- Genre: be specific. Not "jazz" but "modal jazz, late". Not "electronic"
  but "ambient drone, slow attack". Not "lo-fi" by default; only if
  actually heard.
- tempoBpm: best estimate, integer.
- key: musical key if confident (e.g. "A minor"), else "unclear".
- instruments: ordered by prominence. Be specific ("upright bass" not
  "bass"; "Rhodes piano" not "piano" if you can tell).
- ambientLayers: non-music sounds in the recording. Examples: "espresso
  machine hiss", "low chatter, intermittent", "rain on glass", "wok flame".
  Order by prominence. Empty array if pure music with no room tone.
- audioMood: 3 to 5 words. Avoid "vibey", "aesthetic", "cool", "lofi".
  Prefer "introspective", "melancholy", "patient", "communal", "dense".
- musicalCharacter: one sentence, 8 to 20 words, describing texture:
  e.g. "a sparse Rhodes over a soft tape hiss, single bass note held".

Output strict JSON. No prose.`;

export async function analyzeAudio(
  audioBase64: string,
  mimeType: string = "audio/mp3",
): Promise<AudioAnalysis> {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: "Analyze this audio. Return strict JSON matching the schema.",
          },
          { inline_data: { mime_type: mimeType, data: audioBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.4,
      response_mime_type: "application/json",
      response_schema: AUDIO_SCHEMA,
    },
  };

  const res = await fetch(`${BASE}/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": k,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gemini audio ${res.status}: ${text.slice(0, 600)}`);
  }

  type Resp = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const data = (await res.json()) as Resp;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("gemini audio: empty response");

  return JSON.parse(text) as AudioAnalysis;
}
