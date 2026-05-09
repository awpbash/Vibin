# Viber — pitch story

4-minute solo demo. AIE Singapore, May 2026.

**The line on the title slide (and the laptop sticker):**

> Atmosphere is a data type now.

That's what you want the judges remembering at lunch.

---

## The script

### [0:00–0:15] HOOK

> "Open Google Maps. Try to search for 'a cafe that feels like a Lisbon jazz bar at midnight.'
>
> *[pause two beats]*
>
> You can't. Because feeling isn't a data type. Tonight, it is."

### [0:15–0:45] THE WHY

> "Yelp tells you four stars. Maps tells you 'open now.' Neither tells you whether a place feels like Sunday morning, or focused work, or the cafe in your favorite movie.
>
> The reason is technical: until very recently, AI couldn't extract atmosphere from a clip with the specificity you'd need. Now it can. Palette. Soundscape. Tempo. Key. Lighting. Mood. As JSON.
>
> Once atmosphere is structured data, three things become possible: read it, search by it, generate from it. Three loops, one shared object. We call it a VibeObject."

### [0:45–0:55] HANDOFF

> "Pick any YouTube clip. A volunteer — anyone."
>
> *[Volunteer picks. Paste into the field.]*

### [0:55–1:45] DEMO — EXTRACT (live, real)

> *[Page tints toward the palette as fields stream in.]*
>
> "What you're seeing is the vibe being extracted in real time. Eight frames analyzed by GPT vision. Three 10-second audio slices analyzed three independent times by GPT-4o audio, then reconciled. A seven-stage creative brief that grounds every output in what was actually observed.
>
> The system isn't writing prose about the place. It's writing structured atmosphere a search engine can query."

### [1:45–2:45] DEMO — SEARCH (live, against pre-seeded cafes)

> "Now the same atmosphere becomes a search query. Fifty cafes pre-indexed within two kilometres of this venue. Three results."
>
> *[Map view. Three numbered pins drop sequentially. Click pin 1.]*
>
> "[Cafe name]. Three hundred metres from this room. Why does it match? Because the system already extracted its baseline atmosphere — and it shares the palette and the soundscape with what you just pasted.
>
> This isn't 'cafes with brown tones.' It's a sensory match."

### [2:45–3:30] DEMO — GENERATE (pre-rendered, do not run live)

> "Can't go right now? Generate it."
>
> *[Click play. Pre-rendered 60s preview plays.]*
>
> "What you're hearing is from ElevenLabs Music, prompted by a brief that grounded itself in your source audio's actual tempo, key, and instruments. What you're watching is from Fal Veo — four eight-second clips chained by first and last frames so it reads as one continuous take."

### [3:30–3:55] CLOSE

> "This isn't an app. It's a capability demo. AI can finally read atmosphere as data. The day that becomes a primitive, search stops being keywords and starts being feelings, generation becomes context-aware, and 'what is this place like' stops being a Yelp review and starts being a query.
>
> We searched the real world by feeling. We found three cafes within walking distance. You can walk to any of them tonight."

### [3:55–4:00] DROP

> "Atmosphere is a data type now."

---

## Things you must NOT say

- **"Map gets richer with every user"** — unearned, you cut tagging.
- **"Like Yelp, but for vibes"** — diminishing comparison; you're doing something Yelp can't.
- **"Powered by GPT-5.5 / Veo 3.1 / etc"** — never list models in a pitch. Sounds like a wrapper.
- **"In a world where..."** / **"Imagine if..."** — hackathon poison.
- **"Three hour ambient sessions"** — you have 60 seconds. Don't promise what isn't built.

## Q&A — have these ready

**"Couldn't I just use TikTok geotags?"**
> TikTok shows you content. It can't tell you the cafe at the corner shares the same atmosphere with five others nearby. The match needs structured data. That's what we built.

**"How does it scale?"**
> Two paths: cafe owners self-tag with a 15-second capture, or we run vision on existing Google Photos at index time. Both are real, both are out of solo scope.

**"Why not just embed everything?"**
> Single-vector embeddings collapse the facets — palette, sound, mood. We keep them separate so a query like 'same lighting but more energy' is one cosine away.

**"Is the music / video pre-rendered?"**
> Extraction and search are live. Generation is pre-rendered for the demo because Veo takes about five minutes per clip — we don't want to spend a quarter of our time staring at a progress bar. The pipeline is real and runs end-to-end; we ran it last night.

## If live extraction fails

You have three pre-rendered demo bundles (Tokyo coffee, Lisbon jazz, hawker). Reach for the matching one as fast as possible. **Never apologize.** Say: *"Network's against us — same flow, pre-extracted."* Keep moving.

## Why this story works

The framing is **capability, not product**. It's honest about what you built (a tech demo) while making the implications feel large. The volunteer-picks-the-URL beat is the one judges will tell each other about at lunch. The drop line is short enough to remember.

The whole thing is 3 min 45 plus 15 seconds of stage buffer. Practice it three times tonight. Don't read from notes.

---

## Pre-demo checklist (night before)

- [ ] Three pre-rendered demo bundles saved with playable URLs (Tokyo / Lisbon / hawker)
- [ ] Fifty cafes pre-seeded with vibe baselines, persisted to `.viber/places.json`
- [ ] One full live end-to-end run on a fresh YouTube URL — confirm extraction returns specific, grounded fields (not generic slop)
- [ ] Phone hotspot ready as a network fallback
- [ ] Screen recording of the full demo as the absolute fallback if everything dies on stage
- [ ] Laptop on AC, screen mirror tested with the venue projector
- [ ] Volunteer-pick demo: have one strong YouTube URL queued in case nobody volunteers
- [ ] Practice the drop line out loud three times
