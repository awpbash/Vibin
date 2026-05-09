// Vibe-to-place search. In-memory cosine over a small corpus is fine for
// solo demo (we only pre-seed ~50 places near the venue).
//
// Real version:
//   1. Google Maps Places nearbySearch for cafes within 2km of user
//   2. For each place without a baseline vibe, infer one from photos + reviews
//   3. Compute cosine vs query vibe
//   4. Top-K
//   5. GPT-5.5 generates "why this matches" for each

import type { Place, VibeObject } from "./types";

export function cosine(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export type Indexed = { place: Place; vibe: VibeObject };

export function rank(query: VibeObject, corpus: Indexed[]): Place[] {
  if (!query.embedding) return corpus.map((c) => c.place);
  return corpus
    .map((c) => {
      const score =
        c.vibe.embedding && query.embedding
          ? cosine(query.embedding, c.vibe.embedding)
          : Math.random() * 0.3 + 0.5;
      return { ...c.place, matchScore: score };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

