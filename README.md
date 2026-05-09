# Viber

> Search the real world by vibe.

A YouTube link or fifteen seconds of any room becomes a palette, a soundscape, a tempo, a mood. That object then walks two directions at once — sideways into Google Maps to find cafes within 2km that feel the same, and forward into a generative pipeline that renders a 60–90s ambient ride video set to matched music. One artifact, three loops.

Built solo for AI Engineering Singapore 2026.

---

## The pitch

Most AI side-projects produce one artifact and the demo ends there. A song, an image, a video — and then what. Viber's primitive is a `VibeObject`: a serializable, searchable, embeddable atmosphere. Palette and lighting and density and time-of-day. A 1536-dim embedding for cosine search. An `audioAnalysis` block that names the tempo, key, and instruments the model actually heard. A `creativeBrief` block — seven stages deep — that downstream renders cite verbatim so the music, the chained Veo clips, and the still frames all reference the same imagined moment instead of drifting into three different cafes.

The demo killer: a judge picks any YouTube URL. Ninety seconds later, three real cafes within 2km of the venue are pinned on a map, ranked by feeling instead of stars, each with a generated quote on why it matches the source. Click play and the ambient version starts. The map gets richer with every user. Yelp's emotional layer.

---

## How it works

```
                    ┌───────────────────────┐
                    │     VIBE OBJECT       │
                    │  palette, tempo,      │
                    │  density, soundscape, │
                    │  mood, embedding,     │
                    │  audio + brief        │
                    └───────────┬───────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
       ┌─────────┐         ┌──────────┐        ┌──────────┐
       │ EXTRACT │         │  SEARCH  │        │ GENERATE │
       │ youtube │         │  google  │        │  music + │
       │ + audio │         │  places  │        │ veo chain│
       └─────────┘         └──────────┘        └──────────┘
```

**EXTRACT** — `lib/extract.ts:50` pulls the source via yt-dlp (or accepts an upload), samples 1 fps up to 24 frames at 768px, and runs vision and audio analysis in parallel. The audio result overrides the vision-guessed `musicAnchor` whenever music is present, and any ambient layers the audio model heard get merged into the soundscape.

**SEARCH** — `lib/places-search.ts:44` calls Google Places (New) within a 2km radius of the venue, infers a baseline `VibeObject` per candidate from photos and reviews, embeds it, and ranks by cosine similarity. Baselines are cached on disk because they're stable for the life of the hackathon.

**GENERATE** — `lib/generate.ts:636` builds the creative brief, generates a music bed (default: source-bridged ElevenLabs Music with optional SFX layer), then chains four 8s Veo 3 Fast clips with first/last-frame interpolation so the four clips read as one ~32s continuous take. ffmpeg stitches and muxes the music underneath.

---

## The AI pipeline

The interesting part. Five techniques worth pointing at.

### 1. Two-pass Plan-and-Solve vision

`lib/extract.ts:409` splits vision into two grounded passes instead of one free-association call. Pass 1 is an evidence inventory — light sources, surfaces, props, palette samples drawn from real pixels — and is *forbidden* to infer atmosphere words. Every observation is prefixed with a frame index. Pass 2 is text-only synthesis from those grounded observations into the canonical `VibeObject`, with a leading `plan` field that cites which observations drove each non-trivial decision (`lib/extract.ts:598`). Conservative defaults fire when evidence is absent. The schema includes the `plan` field so reasoning happens *inside* the structured response, not as throwaway prose.

### 2. The `beatCount10s` tempo trick

`lib/audio-analysis.ts:36`. Tempo is the single most failure-prone audio task for general multimodal models — they soft-guess "90 bpm" for everything. Forcing the model to first emit `beatCount10s` (the integer count of beats it actually heard in the 10s slice) and then derive `tempoBpm = beatCount10s * 6` reframes the task from estimation to counting + arithmetic, both of which it can do. The schema lists `beatCount10s` *before* `tempoBpm` so structured-output decoding has to commit to the count first; tempo is then anchored. `normalizeSlice` (`lib/audio-analysis.ts:340`) defends the invariant in code — if the model emits a mismatch, the count wins.

### 3. Three-slice self-consistency on audio

`lib/audio-analysis.ts:211`. Three 10s slices (intro, mid, outro) of the source audio are analyzed in parallel by `gpt-4o-audio-preview`, then a text-only reconciliation pass on `gpt-5.4` applies fixed consensus rules: median tempo, 2-of-3 agreement for instruments and ambient layers, longest non-empty `vocalCharacter`. If the reconciliation LLM call fails, `localReconcile` (`lib/audio-analysis.ts:358`) implements the same rules deterministically in TypeScript so the pipeline still ships an `AudioAnalysis`.

### 4. Seven-stage least-to-most creative brief

`lib/creative-brief.ts:486`. Coherence across renders is owned by one LLM reasoning pass instead of being assembled at video time. Seven sequential structured-output calls — subject, three shots, hero shot, vocal decision, lyrics (only if vocals were decided), music prompt, four chain prompts — each carrying every prior stage forward. Every schema starts with a `plan` string for guided chain-of-thought. The shots stage requires that each shot description reuse a noun phrase from the subject paragraph *verbatim*. The music prompt cites the source's tempo, key, and top instruments inside a `[REFERENCE FROM SOURCE]` block. The four Veo chain prompts each end with the literal sign-off `Camera locked off. Documentary footage, not music video.`

### 5. COVE verification with cheap deterministic Layer 1

`lib/verify-brief.ts:258`. Chain-of-Verification, two layers. Layer 1 is pure TypeScript: subject grounding (does the paragraph mention any lighting word, palette hex, or visualMotif noun?), shot prop citation (does each shot description contain a verbatim noun phrase from the subject?), hero motion event count (≥3 timestamped clauses?), music prompt audio citations (tempo + key + 2-of-3 top instruments?), chain prompt continuity (clip 0 must *not* contain "picking up"; clips 1+ must contain a continuation cue; every clip ends with the sign-off). Layer 1 is free and catches the common failures. Only fields that fail get sent to Layer 2 — a per-field LLM repair on `gpt-4o-mini`. Single-round policy: re-run Layer 1 once after repair, log remaining failures, do not repair again.

### 6. Music as a source-aware bridge, not a fresh generation

`lib/generate.ts:182`. Default backend is `bridge`: take the persisted 30s source audio sample, slice it into a 15s head (with 1s fade-in) and 15s tail (with 1s fade-out), generate a 60s ElevenLabs Music body using a prompt that explicitly tells the model "this is a continuation, do not open from silence, end softly", then `acrossfade` head→body→tail with a 5s crossfade on each side. Optional SFX layer (`lib/generate.ts:232`) generates a 22s ElevenLabs Sound Effects bed from the audio analysis's ambient layers, loops it under the music at -15 dB. The result reads as one continuous recording of the room, not a generated track stapled to silence.

### 7. Veo chain mode, not a slideshow

`lib/generate.ts:459`. Four 8s Veo 3 Fast clips chained via image-to-video: clip 0 is text-to-video, every subsequent clip's `firstFrame` is the previous clip's last frame extracted with ffmpeg `-sseof -1`. The handoffs are seamless because each clip *literally* begins on the previous clip's final frame. ffmpeg concatenates with a 0.2s xfade — ornamental, since the frames already match. Hero-only mode is the cheap fallback: one 8s Veo with native audio, the player loops the file. No stills, no Ken Burns zoompan anywhere — these are the two things that make AI video look AI.

---

## Stack

**Frontend**
- Next.js 15.5 (App Router, Turbopack)
- React 19, TypeScript 5.7
- Tailwind CSS 4 (inline `@theme` in `app/globals.css`, no config file)
- framer-motion, `@vis.gl/react-google-maps`

**AI / generation**
- OpenAI: `gpt-5.4` / `gpt-5.4-mini` (vision, brief), `gpt-4o-audio-preview` (audio slices), `gpt-4o-mini` (brief repair, light tasks), `text-embedding-3-large`, `gpt-image-2`
- Google Gemini 3 Flash (optional image / Veo backend)
- Fal.ai Veo 3 Fast (hero motion, image-to-video for chain)
- ElevenLabs Music + Sound Effects
- Google Maps Places API (New)

**Infra**
- Neon Postgres + drizzle-orm for vibes / places persistence (with `.viber/*.json` sidecar fallback)
- Vercel Blob for generated mp3 / mp4 (with `/public/generated/` fallback for local dev)
- Vercel for deploy
- yt-dlp + ffmpeg as system dependencies

---

## Run locally

```bash
git clone <repo>
cd viber
npm install
```

Create `.env.local` and fill in your keys (see the table below). The current repo does not ship a `.env.local.example` template — copy from the table and paste.

```bash
# system deps (real mode only)
brew install yt-dlp ffmpeg            # macOS
# or:  apt install ffmpeg && pip install yt-dlp

# initialise the Neon schema (idempotent, all CREATE IF NOT EXISTS)
npx tsx scripts/init-db.ts

# dev server
npm run dev                           # localhost:3000
npm run mobile                        # 0.0.0.0:3000 — phone on same wifi
```

For real device testing — camera and geolocation need HTTPS:

```bash
ngrok http 3000
```

Optional one-time bake of the three featured demo vibes (extract + music + four-clip chain, ~5–7 min per sample):

```bash
npx tsx scripts/prebake-demos.ts
```

---

## Required env vars

| Variable | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | yes | Vision, audio reconcile, brief, embeddings, place baselines |
| `ELEVENLABS_API_KEY` | yes (for generate) | Music + Sound Effects bed |
| `FAL_API_KEY` | yes (for video) | Veo 3 Fast text-to-video and image-to-video |
| `GOOGLE_MAPS_API_KEY` | yes (for live search) | Server-side Places (New) |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | yes (for the map) | Client-side map embed (same key, restrict by domain) |
| `DATABASE_URL` | optional | Neon Postgres. Falls back to `.viber/*.json` if unset |
| `BLOB_READ_WRITE_TOKEN` | optional | Vercel Blob for generated assets. Falls back to `/public/generated/` |
| `GEMINI_API_KEY` | optional | Alternate audio / image / Veo backend |
| `YOUTUBE_API_KEY` | optional | Metadata only — extraction uses yt-dlp directly |
| `VIBER_VENUE_LAT` / `_LNG` | optional | Centre point for nearby search (default: central Singapore, 1.3018, 103.8553) |
| `VIBER_VENUE_RADIUS_M` | optional | Default 2000 |
| `VIBER_VIDEO_MODE` | optional | `chain` (default, 4× 8s Veo) or `hero-only` (1× 8s, cheaper) |
| `VIBER_MUSIC_BACKEND` | optional | `bridge` (default) or `elevenlabs` |
| `OPENAI_VISION_MODEL` | optional | Default `gpt-5.4-mini`, falls back through 5-mini, 4o-mini, 4o |

Three fixture vibes (`tokyo-coffee`, `lisbon-jazz`, `midnight-hawker`) are hardcoded in `lib/fixtures.ts` — the landing page renders them with no API keys, so the demo runs even with zero generated content.

---

## Project structure

```
app/                    Next.js App Router pages + API routes
  page.tsx              Landing — hero, polaroid stack, sample chips
  v/[id]/               Vibe detail + fullscreen player
  api/                  extract / vibe / search / generate
components/             Polaroid, PaintChips, FieldMap, PlaceCard, ApplyPalette, ...
lib/
  extract.ts            yt-dlp + ffmpeg + two-pass vision + audio
  audio-analysis.ts     3-slice self-consistency on gpt-4o-audio
  creative-brief.ts     7-stage least-to-most pipeline
  verify-brief.ts       COVE — Layer 1 deterministic + Layer 2 LLM repair
  generate.ts           Bridge music + Veo chain + ffmpeg stitch
  places-search.ts      Google Places + cosine ranking
  fixtures.ts           Three hardcoded fallback vibes
  vibe-store.ts         Neon-or-JSON persistence
  storage.ts            Vercel Blob-or-disk asset storage
  types.ts              VibeObject, AudioAnalysis, CreativeBrief, Place
scripts/
  init-db.ts            Run lib/db/init.sql against DATABASE_URL
  prebake-demos.ts      Full end-to-end bake of the three samples
public/
.viber/                 Local dev sidecar (gitignored): vibes.json, by-url.json, uploads/
```

---

## The pipeline (real mode)

### Extract

```
YouTube URL
  └─ yt-dlp → v.mp4 (≤720p)
       └─ ffprobe → duration
            └─ ffmpeg × 8 → frames (JPEG, 1280px wide)
                 └─ GPT-5.5 vision (structured output) → VibeObject draft
                      └─ text-embedding-3-large → 3072-dim vector
                           └─ saved to .viber/vibes.json
```

The vision model receives the 8 frames and a structured output schema enforcing the full `VibeObject` shape. The embedding is built from a concatenated text representation of all fields.

### Search

Places are scored against the query vibe using **cosine similarity** over the `text-embedding-3-large` embeddings. In real mode, the app calls Google Maps Places API for cafes within 2km of the venue, infers a baseline vibe from photos and reviews, then ranks by embedding distance.

### Generate

```
VibeObject
  ├─Initially was trained on Gemini 3.1 to generate video and music 
  ├─ ElevenLabs
  ├─ Fal Veo 3 Fast (8s, 720p, with audio)
  ├─ OpenAI GPT 5.4 Chat
  └─ ffmpeg
       ├─ Ken Burns zoom on each still (zoompan)
       ├─ xfade transitions between stills
       ├─ xfade into Veo hero clip
       └─ → /public/generated/{vibeId}.mp4       ~free
```

**Rough cost per preview: ~$1.88**

Stills-only mode (no `FAL_API_KEY`): ~$0.68, player shows palette gradient instead of Veo clip.

---

## Persistence

Vibes survive `next dev` restarts via JSON sidecars in `.viber/`:

| Time | Beat |
|---|---|
| 0:00 – 0:15 | "We turned Google Maps into a search engine for vibes." Map of the venue area, generic. |
| 0:15 – 0:45 | Volunteer picks a YouTube URL of a cafe ambient video. Paste into Viber. |
| 0:45 – 1:30 | The vibe object streams in. Page background tints toward the palette. Soundscape, mood, music details appear in editorial type. |
| 1:30 – 2:15 | Cut to map. Three numbered pins drop in sequentially. Pre-seeded results within 2km. |
| 2:15 – 2:45 | Click pin 1. Place card slides in. The "why this matches" quote references the same palette and instruments. |
| 2:45 – 3:30 | "Can't go now? Play it." The 60–90s generated preview plays — bridged music, four-clip Veo chain. |
| 3:30 – 4:00 | "Every place gets vibe-tagged. Map gets richer with every user. Yelp's emotional layer." |

---

## What's intentionally not built

Solo scope, brutal triage. These ship later, not at the hackathon.

- **Adaption Labs nightly run** — events are logged but no offline batch retrains the place baselines.
- **Three-hour long-form rendering** — only the 60–90s preview exists. Long-form is a stage we cut for time.
- **User place tagging flow** — baselines come from photos and reviews, not user-submitted vibes.
- **Facet-aware similarity** — single global embedding, no per-facet (palette / sound / mood) ranking.
- **ACRCloud audio fingerprinting** — the audio model identifies character, not specific tracks.
- **User auth / profiles / saved vibes / sharing** — none of it. The artifact survives in the URL.
- **Live geolocation** — the venue is hardcoded to central Singapore via `VIBER_VENUE_LAT/LNG`.

---

*Built solo for AI Engineering Singapore 2026.*
