// DB-backed implementations of the four persistence APIs that
// lib/persist.ts exposes. Same shape as the JSON-sidecar versions so
// callers don't change.

import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "./client";
import type { Place, VibeObject } from "../types";

export type StoredPlace = Place & { inferredVibeId?: string };
export type StoredBaseline = VibeObject & {
  googlePlaceId: string;
  cachedAt: number;
};

// ---------- vibes ----------

export async function dbLoadVibes(): Promise<Record<string, VibeObject>> {
  const rows = await getDb()
    .select({ id: schema.vibes.id, data: schema.vibes.data })
    .from(schema.vibes);
  const out: Record<string, VibeObject> = {};
  for (const r of rows) out[r.id] = r.data as VibeObject;
  return out;
}

export async function dbListVibes(limit = 50): Promise<VibeObject[]> {
  const rows = await getDb()
    .select({ data: schema.vibes.data })
    .from(schema.vibes)
    .orderBy(desc(schema.vibes.createdAt))
    .limit(limit);
  return rows.map((r) => r.data as VibeObject);
}

export async function dbSaveVibe(v: VibeObject): Promise<void> {
  await getDb()
    .insert(schema.vibes)
    .values({
      id: v.id,
      data: v as unknown as Record<string, unknown>,
    })
    .onConflictDoUpdate({
      target: schema.vibes.id,
      set: {
        data: v as unknown as Record<string, unknown>,
        updatedAt: sql`now()`,
      },
    });
}

// ---------- url cache ----------

export async function dbGetCachedVibeIdForUrl(
  url: string,
): Promise<string | null> {
  const rows = await getDb()
    .select({ vibeId: schema.urlCache.vibeId })
    .from(schema.urlCache)
    .where(sql`${schema.urlCache.url} = ${url}`)
    .limit(1);
  return rows[0]?.vibeId ?? null;
}

export async function dbCacheVibeIdForUrl(
  url: string,
  vibeId: string,
): Promise<void> {
  await getDb()
    .insert(schema.urlCache)
    .values({ url, vibeId })
    .onConflictDoUpdate({
      target: schema.urlCache.url,
      set: { vibeId },
    });
}

// ---------- places ----------

export async function dbLoadPlaces(): Promise<Record<string, StoredPlace>> {
  const rows = await getDb()
    .select({ id: schema.places.id, data: schema.places.data })
    .from(schema.places);
  const out: Record<string, StoredPlace> = {};
  for (const r of rows) out[r.id] = r.data as StoredPlace;
  return out;
}

export async function dbSavePlaces(
  next: Record<string, StoredPlace>,
): Promise<void> {
  const db = getDb();
  // Upsert each place. The set is small (≤50) so per-row is fine.
  await Promise.all(
    Object.values(next).map((p) =>
      db
        .insert(schema.places)
        .values({
          id: p.id,
          data: p as unknown as Record<string, unknown>,
        })
        .onConflictDoUpdate({
          target: schema.places.id,
          set: {
            data: p as unknown as Record<string, unknown>,
            updatedAt: sql`now()`,
          },
        }),
    ),
  );
}

// ---------- place baselines ----------

export async function dbLoadBaselines(): Promise<
  Record<string, StoredBaseline>
> {
  const rows = await getDb()
    .select({
      googlePlaceId: schema.placeBaselines.googlePlaceId,
      data: schema.placeBaselines.data,
    })
    .from(schema.placeBaselines);
  const out: Record<string, StoredBaseline> = {};
  for (const r of rows) out[r.googlePlaceId] = r.data as StoredBaseline;
  return out;
}

export async function dbSaveBaselines(
  next: Record<string, StoredBaseline>,
): Promise<void> {
  const db = getDb();
  await Promise.all(
    Object.values(next).map((b) =>
      db
        .insert(schema.placeBaselines)
        .values({
          googlePlaceId: b.googlePlaceId,
          data: b as unknown as Record<string, unknown>,
          cachedAt: b.cachedAt,
        })
        .onConflictDoUpdate({
          target: schema.placeBaselines.googlePlaceId,
          set: {
            data: b as unknown as Record<string, unknown>,
            cachedAt: b.cachedAt,
          },
        }),
    ),
  );
}
