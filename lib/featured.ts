// Placeholder until scripts/prebake-demos.ts has been run. Once you
// run `npx tsx scripts/prebake-demos.ts`, this file will be overwritten
// with the three baked vibe IDs and the landing-page sample chips will
// link directly to /v/{vibeId} instead of the live extraction path.

export type FeaturedSample = {
  label: string;
  url: string;
  vibeId: string;
};

export const FEATURED: FeaturedSample[] = [];
