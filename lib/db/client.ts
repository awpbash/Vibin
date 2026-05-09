// Neon serverless Postgres client. HTTP-based driver — works in Node
// AND Edge runtimes, no connection pooling worries on Vercel.
//
// Set DATABASE_URL in .env.local (and in Vercel project env vars) to
// activate. When it's missing, lib/persist.ts falls back to the local
// JSON sidecar so dev keeps working without a DB.

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let cached: ReturnType<typeof drizzle> | null = null;

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getDb() {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL missing — set it or rely on the JSON sidecar fallback",
      );
    }
    const sql = neon(url);
    cached = drizzle(sql, { schema });
  }
  return cached;
}

export { schema };
