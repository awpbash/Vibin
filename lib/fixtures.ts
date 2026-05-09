// Hardcoded fallback vibes the FieldMap pins point to. Loaded into the
// in-memory store at hydrate time so the demo always has something to
// render — even on a cold Vercel function with an empty DB. Replaced
// transparently by any matching id present in storage.
//
// Empty by default. Real baked vibes live in Neon DB; bake them via
// scripts/bake-fixture.ts after running the local pipeline.

import type { VibeObject } from "./types";

export const FIXTURE_VIBES: Record<string, VibeObject> = {};
