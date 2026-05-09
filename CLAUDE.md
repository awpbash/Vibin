# viber — Claude Code context

## What this project is

Viber is a "vibe-sensing" web app. Record 15 seconds of any room → GPT vision extracts palette, soundscape, mood, music anchor → cosine search finds nearby cafes that feel the same → Fal Veo + GPT Image generates a 60-second ambient preview.

Built for AIE Singapore 2026. Solo demo unit, venue pinned to central Singapore.

## Stack

- Next.js 15 (App Router, Turbopack)
- React 19
- Tailwind CSS 4 (inline `@theme` in globals.css — no tailwind.config file)
- OpenAI SDK (vision, images, embeddings)
- Fal.ai (Veo 3 Fast video generation)
- Google Maps Static API + Places New API

## Running locally

```bash
npm run dev          # desktop browser
npm run mobile       # exposes on 0.0.0.0:3000 for phone testing
```

For camera access on a real phone, use ngrok:
```bash
ngrok http 3000      # gives HTTPS URL — camera + geolocation work
```

Current local IP: `172.31.11.242` (may change — run `ifconfig | grep "inet "`)

## Mock vs real mode

`USE_MOCK_PIPELINE` defaults to `"true"` — all three fixture vibes work instantly with no API keys.

Set `USE_MOCK_PIPELINE=false` in `.env.local` to enable the real pipeline. Requires:
- `OPENAI_API_KEY`
- `yt-dlp` and `ffmpeg` installed on the system
- `FAL_API_KEY` for Veo (optional — stills-only without it)
- `GOOGLE_MAPS_API_KEY` for the map embed (optional)

## Fixture vibes (always available in mock mode)

- `tokyo-coffee` — warm tungsten, bossa, late afternoon
- `lisbon-jazz` — candlelit, modal jazz, late night
- `midnight-hawker` — fluorescent, wok smoke, communal

## Design language

Analog / field guide / editorial. Key principles:
- Warm paper tones (`--color-paper: #ece3d2`)
- Tactile elements: `.polaroid`, `.tape`, `.stamp`, `.paint-chip`, `.paper-fold`
- Fonts: Newsreader (display), Inter (body), JetBrains Mono (labels/captions)
- Stamp color (`--color-stamp: #a82e1a`) is the only strong accent
- Dynamic palette: `ApplyPalette` injects `--vibe-*` CSS vars per vibe
- Tailwind 4 — responsive utilities work normally, but theme tokens are CSS vars in `globals.css`

**Do not add new color tokens or fonts without matching the analog aesthetic.**

## Mobile layout

- `MobileActionBar` (fixed bottom bar) is the primary CTA on phones — hidden on `md+`
- Desktop `VibeInput` is hidden on mobile (`hidden md:grid`)
- Safe area insets used throughout (`env(safe-area-inset-*)`)
- Minimum 44px touch targets enforced in CSS for mobile

## Key files

| File | Purpose |
|---|---|
| `app/globals.css` | Entire design system — tokens, tactile classes, animations, mobile |
| `lib/types.ts` | `VibeObject` and `Place` types |
| `lib/mock-data.ts` | Fixture vibes, in-memory store, Google Places fallback |
| `lib/extract.ts` | Real pipeline: yt-dlp → ffmpeg → GPT vision → embedding |
| `lib/generate.ts` | GPT Image stills + Fal Veo + ffmpeg stitch (~$1.88/preview) |
| `lib/samples.ts` | Shared YouTube sample data (used by VibeInput + MobileActionBar) |
| `app/wizard/page.tsx` | Field Lab — live pipeline inspector with curl commands |

## Persistence

`.viber/` directory (gitignored):
- `vibes.json` — all vibes by id, survives `next dev` restarts
- `by-url.json` — YouTube URL → vibeId cache
- `uploads/` — uploaded clips
- `tmp/` — scratch space, auto-purged

## Conventions

- Tailwind responsive: `sm:` `md:` `lg:` work normally
- Mobile-first breakpoint for layout switches: `md` (768px)
- Component files: PascalCase in `components/`
- No shared state or context — everything is prop-drilled or server-fetched
- API routes: `runtime = "nodejs"`, `maxDuration = 300` (long for pipeline)
- Do not add comments explaining what code does — only add them for non-obvious WHY

## What's intentionally not built yet

- User authentication / saved vibes
- Real-time user geolocation (venue is currently hardcoded to Singapore)
- Live Google Places search at query time (uses fixture places in mock mode)
- The "three hour" full session (only 90s preview exists)
