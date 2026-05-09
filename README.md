# viber.

> *Shazam, but for vibes.*

Record fifteen seconds of any room you love. Viber reads the palette, the soundscape, the music underneath — then finds the cafes near you that feel the same.

Built for **AIE Singapore 2026** as a field experiment in vibe-sensing.

---

## What it does

1. **Sense** — A short video clip (recorded or YouTube URL) is sampled into 8 still frames. GPT vision extracts palette, lighting, density, energy, soundscape descriptors, a music anchor, and mood tags. The result is embedded with `text-embedding-3-large`.

2. **Locate** — Nearby cafes are scored against the same embedding vector using cosine similarity. Top three are returned ranked by feeling, not stars.

3. **Recreate** — Four cinematic stills are generated with GPT Image 2. A Veo 3 Fast hero clip (8s, with audio) is generated via Fal. ffmpeg stitches them into a ~60-second ambient preview.

---

## Quick start

```bash
git clone <repo>
cd viber
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and paste a YouTube link, or tap the record button on mobile.

**Without any API keys**, the app runs in mock mode — all three fixture vibes work instantly with no external calls.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Real mode | Used for vision extraction (`gpt-5.5`), image generation (`gpt-image-1`), and embeddings (`text-embedding-3-large`) |
| `FAL_API_KEY` | Optional | Fal.ai key for Veo 3 Fast video generation. Skipped if absent — preview falls back to palette gradient |
| `GOOGLE_MAPS_API_KEY` | Optional | Static Maps embed on the vibe detail page |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional | Same key, exposed to the browser for the map image |
| `NEXT_PUBLIC_VIBER_VENUE_LAT` | Optional | Lat of the demo venue pin (default: `1.3018`) |
| `NEXT_PUBLIC_VIBER_VENUE_LNG` | Optional | Lng of the demo venue pin (default: `103.8553`) |
| `USE_MOCK_PIPELINE` | — | Set to `"false"` to enable real extraction. Defaults to mock mode |
| `OPENAI_VISION_MODEL` | — | Override vision model (default: `gpt-5.5`) |
| `OPENAI_IMAGE_MODEL` | — | Override image model (default: `gpt-image-1`) |
| `OPENAI_EMBED_MODEL` | — | Override embedding model (default: `text-embedding-3-large`) |
| `VIBER_USE_VEO` | — | Set to `"false"` to skip Veo generation and use stills-only |
| `VIBER_VEO_MODEL` | — | Override Veo model slug (default: `fal-ai/veo3/fast`) |
| `VIBE_DATA_DIR` | — | Override the `.viber/` data directory path |

### System dependencies (real mode only)

```bash
brew install yt-dlp ffmpeg    # macOS
# or: apt install ffmpeg && pip install yt-dlp
```

---

## Architecture

```
app/
├── page.tsx               Home — hero, polaroid stack, VibeInput (desktop), MobileActionBar
├── wizard/page.tsx        Field Lab — step-by-step pipeline inspector with curl commands
├── v/[id]/
│   ├── page.tsx           Vibe detail — palette, soundscape, mood, nearby, play CTA
│   └── play/page.tsx      Fullscreen ambient player (90s preview)
├── api/
│   ├── extract/route.ts   POST: video file or YouTube URL → { vibeId }
│   ├── vibe/[id]/route.ts GET: full VibeObject + matched places
│   ├── search/route.ts    GET: ?vibeId=X → places ranked by cosine similarity
│   └── generate/route.ts  POST: { vibeId } → { previewVideoUrl }
└── globals.css            Design system — all tokens, tactile classes, mobile CSS

lib/
├── extract.ts             Real pipeline: yt-dlp → ffmpeg frames → GPT vision → embed
├── generate.ts            GPT Image 2 stills + Fal Veo 3 + ffmpeg stitch
├── search.ts              Cosine similarity ranking
├── places-search.ts       Google Maps Places API integration
├── mock-data.ts           Three fixture vibes + place sets, in-memory store + hydration
├── persist.ts             JSON sidecar persistence (.viber/vibes.json, by-url.json)
├── samples.ts             Shared YouTube sample URLs used by VibeInput and MobileActionBar
├── types.ts               VibeObject and Place TypeScript types
├── colors.ts              Color manipulation utilities
└── vibe-prompt.ts         GPT structured output schema + system prompt

components/
├── MobileActionBar.tsx    Fixed bottom bar — record button + URL drawer (mobile only)
├── VibeInput.tsx          Stamp button + URL form + samples (desktop)
├── StampButton.tsx        264px circular stamp CTA
├── Polaroid.tsx           Photo frame with tape strips
├── PaintChips.tsx         Palette color swatches
├── ApplyPalette.tsx       Injects --vibe-* CSS vars from palette hexes
├── PlaceCard.tsx          Tilted card with photo, name, match score, why-it-matches
├── NearbyMap.tsx          Google Static Maps embed with Mercator pin projection
└── Player.tsx             Fullscreen ambient player with Ken Burns gradient
```

---

## Data model

### VibeObject

```ts
type VibeObject = {
  id: string
  source: {
    kind: "youtube" | "capture" | "place_baseline"
    url?: string       // YouTube URL
    title?: string
    placeId?: string
  }

  title: string          // "A Tokyo Coffee Shop, Late Afternoon"
  oneLiner: string       // Evocative one-liner for the vibe

  palette: { name: string; hex: string }[]   // 4 dominant colors
  lighting: string       // e.g. "low, warm tungsten with one cool fill"
  spatial: string        // e.g. "intimate, low ceilings, eight seats"
  visualMotifs: string[] // ["espresso machine", "ceramic cups", ...]

  density: number        // 0–1: how full/busy the space feels
  energy: number         // 0–1: tempo, kinetic feeling
  timeOfDay: "morning" | "midday" | "afternoon" | "evening" | "late-night"
  weatherImplied?: string

  soundscape: string[]   // 5–7 descriptors
  musicAnchor: {
    genre: string
    tempoBpm: number
    key?: string
    referenceTrack?: string
  }
  moodTags: string[]

  embedding?: number[]   // text-embedding-3-large vector for cosine search

  generatedAssets?: {
    previewVideoUrl?: string
    musicUrl?: string
  }

  createdAt: number
}
```

### Place

```ts
type Place = {
  id: string
  googlePlaceId?: string
  name: string
  address: string
  neighbourhood: string
  distanceMeters: number
  walkMinutes: number
  rating: number
  photoUrl: string
  matchScore: number       // 0–1 cosine similarity
  whyThisMatches: string   // GPT-generated match explanation
  hours?: string
  openNow?: boolean
  location: { lat: number; lng: number }
}
```

---

## API routes

### `POST /api/extract`

Accepts either a video file upload or a JSON body with a YouTube URL.

**Multipart (recorded/uploaded video)**
```bash
curl -X POST http://localhost:3000/api/extract \
  -F 'video=@clip.mp4'
```

**JSON (YouTube URL)**
```bash
curl -X POST http://localhost:3000/api/extract \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://www.youtube.com/watch?v=dx9aDku80kM"}'
```

**Response**
```json
{ "vibeId": "v-abc123" }
```

In mock mode, returns one of the three fixture vibes instantly. URL results are cached in `.viber/by-url.json` so the same link doesn't re-run the pipeline.

---

### `GET /api/vibe/[id]`

Returns the full `VibeObject` plus matched places.

```bash
curl http://localhost:3000/api/vibe/tokyo-coffee
```

```json
{
  "vibe": { "id": "tokyo-coffee", "title": "A Tokyo Coffee Shop, Late Afternoon", ... },
  "places": [{ "name": "Apartment Coffee", "matchScore": 0.93, ... }]
}
```

---

### `GET /api/search?vibeId=X`

Returns places ranked by cosine similarity to the vibe's embedding.

```bash
curl 'http://localhost:3000/api/search?vibeId=tokyo-coffee'
```

---

### `POST /api/generate`

Triggers the generation pipeline for a given vibe. Returns cached result if already generated. No-op in mock mode (preview uses palette gradient instead).

```bash
curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"vibeId":"v-abc123"}'
```

**Response**
```json
{ "previewVideoUrl": "/generated/v-abc123.mp4", "durationSeconds": 60 }
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

| File | Contents |
|---|---|
| `.viber/vibes.json` | All `VibeObject`s keyed by id |
| `.viber/by-url.json` | YouTube URL → vibeId cache (prevents re-extraction) |
| `.viber/uploads/` | Uploaded video files (kept for demo replay) |
| `.viber/tmp/` | Scratch space for yt-dlp frames and ffmpeg; auto-purged |

The in-memory store is hydrated from `vibes.json` on first read. Writes are best-effort (don't block the response).

---

## Fixture vibes

Three built-in vibes work in mock mode and serve as fallbacks in real mode:

| ID | Title | Source |
|---|---|---|
| `tokyo-coffee` | A Tokyo Coffee Shop, Late Afternoon | `youtube.com/watch?v=dx9aDku80kM` |
| `lisbon-jazz` | A Lisbon Jazz Bar, After Eleven | `youtube.com/watch?v=lLxK5fEzaAU` |
| `midnight-hawker` | A Hawker Centre, Past Midnight | `youtube.com/watch?v=pBKlFnh96Tg` |

Each fixture has a curated palette, soundscape, music anchor, mood tags, and a matching set of real Singapore venues.

---

## UI & design system

The design language is **analog / field guide** — warm paper tones, polaroids, scotch tape, rubber stamps, hand-drawn annotations.

### Tokens (`globals.css`)

| Variable | Value | Role |
|---|---|---|
| `--color-paper` | `#ece3d2` | Background (warm cream) |
| `--color-paper-hi` | `#f4ecdc` | Elevated surfaces |
| `--color-ink` | `#1c1814` | Primary text |
| `--color-stamp` | `#a82e1a` | Accent / CTA (rust red) |
| `--color-tape` | `#f0c869` | Scotch tape element |
| `--color-pencil` | `#4a3f33` | Hand-drawn annotations |
| `--vibe-*` | dynamic | Injected per-vibe by `ApplyPalette` |

### Tactile classes

| Class | Description |
|---|---|
| `.polaroid` | Photo frame with white border and bottom label panel |
| `.tape` | Scotch tape strip with dotted edges |
| `.stamp` | 264px circular rubber stamp with arc text |
| `.paint-chip` | Color swatch with label tab |
| `.paper-fold` | CSS triangle corner fold |
| `.mobile-bar` | Frosted-glass bottom bar (`backdrop-filter: blur(24px)`) |

### Typography

| Class | Font | Use |
|---|---|---|
| `.display-xl` | Newsreader 500 | Hero headings |
| `.display-italic` | Newsreader 500 italic | Accent text, titles |
| `.eyebrow` | JetBrains Mono | Section labels (uppercase, wide tracking) |
| `.caption` | JetBrains Mono | Metadata, numbers (uppercase, wide tracking) |
| `.field-input` | Newsreader 400 | URL / text inputs |

### Animations

| Class | Description |
|---|---|
| `.reveal` | Fade + slide up (800ms, staggerable with `.reveal-1` → `.reveal-10`) |
| `.reveal-tilt-l/r/m` | Reveal with perspective rotation (for polaroids) |
| `.pulse-soft` | Gentle opacity pulse (used on the stamp while busy) |
| `.record-pulse` | Expanding ring pulse on the mobile record button |
| `.stamp-busy` | Shimmer sweep on the stamp ink texture while processing |

---

## Pages

| Route | Description |
|---|---|
| `/` | Home — hero, polaroid stack, VibeInput (desktop), MobileActionBar (mobile) |
| `/wizard` | Field Lab — step-by-step pipeline inspector with live request/response and curl commands |
| `/v/[id]` | Vibe detail — full analysis across 7 sections (palette, place sense, soundscape, mood, music, nearby, play) |
| `/v/[id]/play` | Fullscreen ambient player — palette gradient / Veo video with progress bar |

---

## Mobile

The app is designed to be used on a phone. On `md` screens and above it renders the standard editorial layout. On mobile:

- A **fixed bottom action bar** (`MobileActionBar`) replaces the inline stamp button. It has:
  - A large red record button that triggers `capture="environment"` for direct camera access
  - A slide-up drawer with the URL input and mini polaroid sample thumbnails
  - Frosted-glass `backdrop-filter` for a native iOS feel
- All layouts respect `env(safe-area-inset-*)` for iPhone notch and home indicator
- Minimum 44px touch targets
- The `viewport` is configured with `viewport-fit=cover`, `maximum-scale=1`, and Apple PWA meta tags

---

## Development

```bash
npm run dev      # Next.js 15 with Turbopack
npm run build    # Production build
npm run lint     # ESLint
```

### Field Lab

`/wizard` is a step-through pipeline inspector. Submit any URL or clip and watch each API call go out and come back, with the full request, response, and a paste-ready `curl` command for each step.

---

## Project context

Built at **AIE Singapore 2026** as a demonstration of vibe-based spatial search. The premise: if Shazam can identify a song from a few seconds of audio, a model with vision and language can identify the *feeling* of a place from a few seconds of video — and use that feeling as a search query against the physical world.

The current build is a solo-mode field unit. The venue is fixed to central Singapore. Real deployment would add:

- User location (browser geolocation or device GPS)
- Live Google Maps Places search within radius
- Per-place vibe inference at query time (photos + reviews → embedding)
- Authenticated sessions and saved vibes
- Push notifications when a matched venue opens

---

*made for places that already exist.*
