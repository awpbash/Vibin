// ElevenLabs API helpers. Music generation + Text to Speech.
//
// Latest models (Nov 2025):
//   Music: ElevenLabs Music (eleven-music) via /v1/music endpoint
//   TTS:   eleven_v3 (alpha, highest quality)
//          eleven_multilingual_v2 (production-grade, default)
//          eleven_turbo_v2_5 (fast)
//          eleven_flash_v2_5 (fastest, ~75ms latency)
//
// Auth:    xi-api-key header
// Pricing: Creator plan = 100k credits/month
//          Music = ~1k credits per 30s
//          TTS multilingual_v2 = 1 credit/char
//          TTS flash = 0.5 credits/char

const BASE = "https://api.elevenlabs.io";

export const VOICE_PRESETS: Record<string, { id: string; description: string }> = {
  sarah: { id: "EXAVITQu4vr4xnSDxMaL", description: "calm, gentle, narrative" },
  rachel: { id: "21m00Tcm4TlvDq8ikWAM", description: "warm, conversational" },
  george: { id: "JBFqnCBsd6RMkjVDRZzb", description: "deep, gravitas, ken-burns" },
  elli: { id: "MF3mGyEYCl7XYWbV9V6O", description: "young, warm" },
  adam: { id: "pNInz6obpgDQGcFmaJgB", description: "deep, authoritative" },
};

export const TTS_MODELS = [
  "eleven_multilingual_v2",
  "eleven_v3",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
] as const;

function key(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY missing");
  return k;
}

// ---------- Music ----------

export type MusicOptions = {
  prompt: string;
  lengthMs?: number;             // 10000 to 300000, default 30000
  outputFormat?: string;         // mp3_44100_128 (default)
};

export async function generateMusic(opts: MusicOptions): Promise<Buffer> {
  const tryOnce = async (prompt: string) => {
    const body = {
      prompt,
      music_length_ms: opts.lengthMs ?? 30000,
      output_format: opts.outputFormat ?? "mp3_44100_128",
    };
    const res = await fetch(`${BASE}/v1/music`, {
      method: "POST",
      headers: {
        "xi-api-key": key(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    });
    return res;
  };

  let res = await tryOnce(opts.prompt);

  // ToS auto-retry: the API returns a sanitised prompt_suggestion when it
  // refuses. Use it once before giving up.
  if (res.status === 400) {
    const text = await res.text().catch(() => "");
    let suggestion: string | null = null;
    try {
      const parsed = JSON.parse(text) as {
        detail?: { data?: { prompt_suggestion?: string } };
      };
      suggestion = parsed.detail?.data?.prompt_suggestion ?? null;
    } catch {
      // ignore
    }
    if (suggestion) {
      res = await tryOnce(suggestion);
    } else {
      throw new Error(`elevenlabs music 400: ${text.slice(0, 500)}`);
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`elevenlabs music ${res.status}: ${text.slice(0, 500)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ---------- Sound Effects (room ambience layer) ----------

export type SoundEffectsOptions = {
  text: string;
  durationSeconds?: number;       // 0.5 to 22, default 22 (max take)
  promptInfluence?: number;       // 0 to 1, default 0.4 (looser = more interpreted)
};

// Generates a single sound-effects take. ElevenLabs caps each take at
// ~22 seconds, so for longer beds the caller should loop / chain.
export async function generateSoundEffects(
  opts: SoundEffectsOptions,
): Promise<Buffer> {
  const body = {
    text: opts.text,
    duration_seconds: Math.min(Math.max(opts.durationSeconds ?? 22, 0.5), 22),
    prompt_influence: Math.min(
      Math.max(opts.promptInfluence ?? 0.4, 0),
      1,
    ),
  };
  const res = await fetch(`${BASE}/v1/sound-generation`, {
    method: "POST",
    headers: {
      "xi-api-key": key(),
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`elevenlabs sfx ${res.status}: ${text.slice(0, 500)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// Build a one-paragraph SFX prompt from the vibe's measured ambient
// layers. If audio analysis exists, those are the literal sounds we
// heard in the source; otherwise fall back to the soundscape array.
export function sfxPromptFromVibe(v: {
  audioAnalysis?: { ambientLayers?: string[] };
  soundscape?: string[];
  spatial?: string;
  density?: number;
}): string {
  const layers =
    v.audioAnalysis?.ambientLayers?.length
      ? v.audioAnalysis.ambientLayers
      : v.soundscape ?? [];
  if (layers.length === 0) {
    return "subtle indoor room tone, low background hum, occasional distant sounds, no music, no speech";
  }
  const density =
    (v.density ?? 0.5) < 0.4
      ? "spacious and quiet"
      : (v.density ?? 0.5) < 0.7
        ? "moderately full"
        : "busy";
  return softenPrompt(
    [
      `Continuous ambient room tone: ${layers.slice(0, 4).join(", ")}.`,
      v.spatial ? `Setting: ${v.spatial}.` : "",
      `Atmosphere: ${density}, naturalistic, no music, no clear speech, no melody.`,
      `This is the room itself, not foreground action. Loop-friendly, no abrupt events.`,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

// ---------- TTS ----------

export type TtsOptions = {
  text: string;
  voiceId?: string;
  voicePreset?: keyof typeof VOICE_PRESETS;
  modelId?: (typeof TTS_MODELS)[number];
  outputFormat?: string;          // mp3_44100_128 default
  stability?: number;             // 0-1
  similarity?: number;            // 0-1
  style?: number;                 // 0-1
};

export async function generateSpeech(opts: TtsOptions): Promise<Buffer> {
  const voiceId =
    opts.voiceId ??
    (opts.voicePreset ? VOICE_PRESETS[opts.voicePreset]?.id : undefined) ??
    process.env.ELEVENLABS_VOICE_ID ??
    VOICE_PRESETS.sarah.id;

  const modelId =
    opts.modelId ??
    (process.env.ELEVENLABS_MODEL_ID as (typeof TTS_MODELS)[number] | undefined) ??
    "eleven_multilingual_v2";

  const outputFormat = opts.outputFormat ?? "mp3_44100_128";

  const body = {
    text: opts.text,
    model_id: modelId,
    voice_settings: {
      stability: opts.stability ?? 0.45,
      similarity_boost: opts.similarity ?? 0.75,
      style: opts.style ?? 0.2,
      use_speaker_boost: true,
    },
  };

  const res = await fetch(
    `${BASE}/v1/text-to-speech/${voiceId}?output_format=${encodeURIComponent(outputFormat)}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": key(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`elevenlabs tts ${res.status}: ${text.slice(0, 500)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

// ---------- Vibe -> prompts ----------

// Words that have tripped ElevenLabs' ToS classifier. We strip these from
// vibe-derived music prompts before sending. The generator already retries
// against the API's prompt_suggestion if a request still gets blocked.
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

// Template fallback used when no creative brief is attached to the
// vibe. The brief produces a much richer prompt; this is the safety
// net. Even the fallback is structured (REFERENCE / STRUCTURE / RULES)
// so ElevenLabs gets enough scaffolding to evolve over 90 seconds
// instead of looping a 15-second motif.
export function musicPromptFromVibe(v: {
  musicAnchor: { genre: string; tempoBpm: number; key?: string; referenceTrack?: string };
  moodTags: string[];
  energy: number;
  density: number;
  spatial: string;
  timeOfDay: string;
  soundscape?: string[];
  audioAnalysis?: {
    genre?: string;
    tempoBpm?: number;
    key?: string;
    instruments?: string[];
    ambientLayers?: string[];
    musicalCharacter?: string;
  };
}): string {
  const a = v.audioAnalysis;
  const genre = a?.genre || v.musicAnchor.genre;
  const tempo = a?.tempoBpm || v.musicAnchor.tempoBpm;
  const key = a?.key || v.musicAnchor.key || "modal, drifting";
  const instruments = (a?.instruments && a.instruments.length
    ? a.instruments
    : []
  ).slice(0, 4);
  const character =
    a?.musicalCharacter ||
    `${
      v.energy < 0.3 ? "very sparse" : v.energy < 0.6 ? "sparse" : "lively"
    }, ${
      v.density < 0.4 ? "intimate" : v.density < 0.7 ? "warm and full" : "open"
    }`;
  const ambient =
    a?.ambientLayers?.[0] ?? v.soundscape?.[0] ?? "the quiet of the room";
  const primary = instruments[0] || "a single lead instrument";
  const secondary = instruments[1] || "a complementary voice";
  const tertiary = instruments[2] || "subtle textural colour";

  const reference = [
    `[REFERENCE FROM SOURCE]`,
    `Genre: ${genre}`,
    `Tempo: ${tempo} bpm`,
    `Key: ${key}`,
    instruments.length
      ? `Lead instruments (in order of prominence): ${instruments.join(", ")}`
      : `Lead instruments: ${primary}, ${secondary}`,
    `Texture: ${character}`,
  ].join("\n");

  const structure = [
    `[STRUCTURE — 90 seconds]`,
    `0:00–0:15 Intro: solo ${primary}, very quiet, no rhythm section yet. Establish the key.`,
    `0:15–0:45 Body: ${secondary} joins. Sparse, breath between phrases. Hold tempo steady.`,
    `0:45–1:15 Development: harmonic motion, brief modal substitutions, ${tertiary} adds colour for 4 to 8 bars then recedes.`,
    `1:15–1:30 Outro: simplifies back to ${primary}, decays into the room — ${ambient} hints in the final 4 seconds.`,
  ].join("\n");

  const roomCtx = `[ROOM CONTEXT]\n${v.timeOfDay} in ${v.spatial}. Mood: ${v.moodTags.slice(0, 3).join(", ")}.`;

  const rules = [
    `[RULES]`,
    `- Never repeat the same melodic motif twice. Each section develops the previous.`,
    `- Leave 1-2 second pauses between phrases. No wall-of-sound.`,
    `- No build to chorus or climax. This is ambient, not pop.`,
    `- Stay in the same key throughout; modal substitutions OK.`,
    `- Instrumental, no vocals.`,
  ].join("\n");

  return softenPrompt([reference, structure, roomCtx, rules].join("\n\n"));
}

export function narrationFromVibe(v: {
  title: string;
  oneLiner: string;
  spatial: string;
  soundscape: string[];
}): string {
  return `${v.title}. ${v.oneLiner} ${v.spatial}. The room itself is the music, ${v.soundscape.slice(0, 2).join(", ")}.`;
}
