// Drizzle table definitions. Mirrors the four JSON sidecars in
// lib/persist.ts: vibes, url cache, places, place baselines.
//
// The corresponding CREATE TABLE SQL lives in lib/db/init.sql — run
// it once in your Neon dashboard. We don't ship drizzle-kit migrations
// to keep the toolchain small for a hackathon.

import {
  bigint,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const vibes = pgTable("vibes", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const urlCache = pgTable("url_cache", {
  url: text("url").primaryKey(),
  vibeId: text("vibe_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const places = pgTable("places", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const placeBaselines = pgTable("place_baselines", {
  googlePlaceId: text("google_place_id").primaryKey(),
  data: jsonb("data").notNull(),
  cachedAt: bigint("cached_at", { mode: "number" }).notNull(),
});
