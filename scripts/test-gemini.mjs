// Quick smoke test for the Gemini API key. Hits a few model endpoints
// and reports which work. Doesn't print the key.

import { readFileSync } from "fs";

function loadKey() {
  let key = process.env.GEMINI_API_KEY;
  if (!key) {
    try {
      const env = readFileSync(".env.local", "utf8");
      const m = env.match(/^GEMINI_API_KEY=(.*)$/m);
      if (m) key = m[1].trim().replace(/^['"]|['"]$/g, "");
    } catch {}
  }
  return key;
}

const KEY = loadKey();
if (!KEY) {
  console.log("FAIL — GEMINI_API_KEY not found in env or .env.local");
  process.exit(1);
}
console.log("key loaded (length=" + KEY.length + ")");

const BASE = "https://generativelanguage.googleapis.com/v1beta";

const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];

async function tryModel(model) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/models/${model}:generateContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Say 'pong' in one word." }] }],
      }),
    });
    const ms = Date.now() - t0;
    const text = await res.text();
    if (res.ok) {
      let snippet = "";
      try {
        const data = JSON.parse(text);
        snippet =
          data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "(empty)";
      } catch {
        snippet = text.slice(0, 80);
      }
      console.log(`PASS  ${res.status}  ${model.padEnd(22)} ${ms}ms  → ${snippet}`);
      return true;
    } else {
      // Compact error: parse for code/message if JSON
      let err = text.slice(0, 200);
      try {
        const data = JSON.parse(text);
        err = `${data.error?.status || ""} ${data.error?.message || text.slice(0, 200)}`;
      } catch {}
      console.log(`FAIL  ${res.status}  ${model.padEnd(22)} ${ms}ms  → ${err}`);
      return false;
    }
  } catch (e) {
    console.log(`ERR   ---  ${model.padEnd(22)} → ${e.message}`);
    return false;
  }
}

console.log("\n--- testing models ---");
for (const m of MODELS) {
  await tryModel(m);
}

// Also test the Veo predictLongRunning endpoint specifically — that's
// the one that was blocked before.
console.log("\n--- Veo predictLongRunning auth check ---");
const veoT0 = Date.now();
try {
  const res = await fetch(`${BASE}/models/veo-3.1-fast-generate-preview:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: "test" }],
      parameters: { durationSeconds: 4, sampleCount: 1 },
    }),
  });
  const ms = Date.now() - veoT0;
  const text = await res.text();
  if (res.ok) {
    console.log(`PASS  ${res.status}  veo-3.1-fast-generate-preview  ${ms}ms`);
    console.log("       → Veo accepts your key. Long-running gen would proceed.");
  } else {
    let err = text.slice(0, 250);
    try {
      const data = JSON.parse(text);
      err = `${data.error?.status || ""} — ${data.error?.message || text.slice(0, 200)}`;
    } catch {}
    console.log(`FAIL  ${res.status}  veo-3.1-fast-generate-preview  ${ms}ms`);
    console.log(`       → ${err}`);
  }
} catch (e) {
  console.log(`ERR   ---  veo-3.1-fast-generate-preview → ${e.message}`);
}
