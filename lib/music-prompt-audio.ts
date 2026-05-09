// Audio-aware music prompt authoring. Sends the persisted 30s source
// sample as inline audio to Gemini 3 Flash and asks it to write the
// final music prompt while actually listening to the recording.
//
// This closes the gap between "extract JSON facts → assemble prompt
// → text-to-music" and "model that ACTUALLY heard the source wrote
// the prompt". The downstream music generator (ElevenLabs / Lyria 3)
// still doesn't hear anything, but the prompt it reads now contains
// concrete musical detail captured by direct listening — chord
// substitutions, microphone reverb, melodic motifs, tape warble,
// the way a bass slides flat at phrase ends — that JSON fields can't.
//
// Cost: ~$0.0003 per call (~960 audio tokens + ~600 output tokens
// on gemini-3-flash-preview).

import { promises as fs } from "fs";
import path from "path";
import type { CreativeBrief, VibeObject } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = process.env.VIBER_GEMINI_AUDIO_MODEL || "gemini-3-flash-preview";

const SYSTEM = `You are listening to a 30-second recording from a real
place. Your job is to write a complete, structured prompt for a text-
to-music model that will generate roughly 60 seconds of CONTINUATION
material to play immediately after this recording.

The continuation must feel like it could play right after the source —
same tempo, same key, same texture, same instruments, same overall
musical character. The downstream model cannot listen — it only reads
what you write. So you must capture what you hear in concrete musical
terms a literate musician could replay.

You will also receive visual context for the place (what the room
looks like, time of day, mood) and a lyrics decision (whether vocals
are appropriate, and the lyrics text if so). Honour those.

Output format — write EXACTLY these four labelled sections, in order,
on plain text with newlines between sections. No JSON, no preamble,
no closing remarks.

[REFERENCE FROM SOURCE — what I literally hear]
- Genre: <specific, e.g. "bossa nova, sparse" or "modal jazz, late">
- Tempo: <exact bpm you heard, integer>
- Key: <key from listening, e.g. "A minor", or "modal" if unclear>
- Lead instruments (in order of prominence): <comma list of actual
  instruments — be specific, "upright bass" not "bass", "Rhodes
  electric piano" not "keys">
- Texture and quirks: <2 to 3 sentences capturing what makes THIS
  recording sound like itself — tape hiss, room reverb, microphone
  proximity, melodic motif you caught (describe it in solfege or
  intervals if you can), chord substitution you noticed, the way the
  bass slides slightly flat at phrase ends, vinyl crackle, brushes
  on snare in a specific cadence, etc. This is what the downstream
  model needs to MATCH so the continuation feels of-a-piece.>

[STRUCTURE — 60 seconds of continuation]
0:00–0:15 Continuation: pick up directly from the source's tempo
  and key, NO fresh intro from silence. <primary instrument>
  continues the texture, perhaps takes a brief lead phrase.
0:15–0:35 Development: harmonic motion, brief modal substitutions,
  <secondary or tertiary instrument> adds colour for 4 to 8 bars then
  recedes.
0:35–0:55 Resolution: simplifies back toward <primary instrument>,
  decays gradually.
0:55–1:00 Outro: very quiet, room ambience hint, no flourish.

[ROOM CONTEXT]
<one sentence about the visual scene and mood, drawn from the supplied
context. Cite the time of day and 2 mood tags.>

[RULES]
- DO NOT include a fresh intro. The piece is already underway when the
  model begins.
- Never repeat the same melodic motif twice. Develop continuously.
- Stay in the same key throughout. Modal substitutions OK.
- Leave 1-2 second pauses between phrases. No wall-of-sound.
- No build to chorus or climax. This is ambient continuation, not pop.
- {Lyrics rule:
  - If hasVocals is TRUE in the supplied context, embed the supplied
    lyrics inline using [Verse 1] / [Chorus] section tags placed at
    appropriate timestamps in the STRUCTURE above, and add one short
    clause describing vocal style (timbre, gender, delivery).
  - If hasVocals is FALSE: include the literal phrase
    "Instrumental, no vocals." here.}
- Forbidden words anywhere in the prompt: trap, drill, gym, workout,
  fight, combat, gun.

End with the final closing line of [RULES]. Do not add anything else.`;

export async function writeMusicPromptListeningToAudio(
  vibe: VibeObject,
  brief: CreativeBrief,
): Promise<string> {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");

  const sampleUrl = vibe.source?.audioSampleUrl;
  if (!sampleUrl) throw new Error("no audioSampleUrl on vibe");

  const samplePath = path.join(
    process.cwd(),
    "public",
    sampleUrl.replace(/^\//, ""),
  );
  const buf = await fs.readFile(samplePath);
  const b64 = buf.toString("base64");

  // Compact context block. Vibe + lyrics decision the brief made.
  const context = [
    `Visual scene: ${brief.subject}`,
    `Time of day: ${vibe.timeOfDay}`,
    `Mood tags: ${vibe.moodTags.slice(0, 4).join(", ")}`,
    `Soundscape (non-music room sounds heard): ${vibe.soundscape.slice(0, 4).join(", ")}`,
    `Lyrics decision: hasVocals=${brief.hasVocals}`,
    brief.hasVocals && brief.lyrics
      ? `Lyrics to embed:\n${brief.lyrics}`
      : `(Instrumental — no lyrics to embed.)`,
  ].join("\n");

  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Listen to the audio below. Write the music prompt in the four required sections, using the visual / lyrics context that follows.\n\n=== CONTEXT ===\n${context}\n=== END CONTEXT ===`,
          },
          { inline_data: { mime_type: "audio/mp3", data: b64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.6,
      response_mime_type: "text/plain",
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
    throw new Error(`audio-aware music prompt ${res.status}: ${text.slice(0, 600)}`);
  }

  type Resp = {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const data = (await res.json()) as Resp;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text)
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("audio-aware music prompt: empty response");

  return text.trim();
}
