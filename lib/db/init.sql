-- Run this once in your Neon dashboard SQL editor (or psql) to create
-- the four tables Viber persists into. Idempotent — re-running is safe.

CREATE TABLE IF NOT EXISTS vibes (
  id           TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vibes_created_at_idx ON vibes (created_at DESC);

CREATE TABLE IF NOT EXISTS url_cache (
  url          TEXT PRIMARY KEY,
  vibe_id      TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS places (
  id           TEXT PRIMARY KEY,
  data         JSONB NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS place_baselines (
  google_place_id  TEXT PRIMARY KEY,
  data             JSONB NOT NULL,
  cached_at        BIGINT NOT NULL
);
