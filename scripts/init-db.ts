// One-shot: read lib/db/init.sql and execute it against DATABASE_URL.
// Idempotent — every statement is `CREATE ... IF NOT EXISTS`.
//
// Run from the repo root:
//   npx tsx scripts/init-db.ts

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { promises as fs } from "fs";
import path from "path";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL missing in .env.local");
    process.exit(1);
  }

  const sqlPath = path.join(process.cwd(), "lib", "db", "init.sql");
  const raw = await fs.readFile(sqlPath, "utf8");

  // Strip line comments first, then split on `;`. The earlier version
  // mistakenly filtered out any statement whose leading lines were
  // comments — that dropped the first CREATE TABLE.
  const stripped = raw
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const statements = stripped
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sql = neon(url);
  console.log(`Running ${statements.length} statements against\n  ${url.replace(/:[^@]*@/, ":***@")}\n`);

  for (const stmt of statements) {
    const head = stmt.split("\n")[0].slice(0, 80);
    process.stdout.write(`  ${head} … `);
    try {
      await sql.query(stmt);
      console.log("ok");
    } catch (e) {
      console.log("FAIL");
      console.error(e);
      process.exit(1);
    }
  }

  console.log("\nDB initialised.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
