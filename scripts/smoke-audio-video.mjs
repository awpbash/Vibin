// Smoke test for AI service endpoints used by Viber.
// Run: node scripts/smoke-audio-video.mjs
//
// Loads keys from .env.local (line-by-line, no dotenv).
// Hits each endpoint with a minimal payload and prints PASS/FAIL + a snippet.
// Aborts Fal Veo after ~5s so we never burn the full $0.40 generation cost.

import { readFileSync, existsSync, writeFileSync, statSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const envPath = join(projectRoot, ".env.local");

// ---------- env loader ----------
function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const txt = readFileSync(path, "utf8");
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const env = loadEnv(envPath);
const OPENAI_KEY = env.OPENAI_API_KEY || "";
const ELEVEN_KEY = env.ELEVENLABS_API_KEY || "";
const FAL_KEY = env.FAL_API_KEY || "";

console.log("=== Viber smoke test ===");
console.log(`env file: ${envPath}`);
console.log(`OPENAI_API_KEY:     ${OPENAI_KEY ? "key loaded" : "key missing"}`);
console.log(`ELEVENLABS_API_KEY: ${ELEVEN_KEY ? "key loaded" : "key missing"}`);
console.log(`FAL_API_KEY:        ${FAL_KEY ? "key loaded" : "key missing"}`);
console.log();

// ---------- helpers ----------
const results = [];
function record(endpoint, status, modelOrId, latency, snippet) {
  const trimmed = (snippet || "").replace(/\s+/g, " ").slice(0, 200);
  results.push({ endpoint, status, modelOrId, latency_ms: latency, snippet: trimmed });
}

function snip(s, n = 200) {
  return (s || "").replace(/\s+/g, " ").slice(0, n);
}

async function timed(fn) {
  const t0 = Date.now();
  try {
    const v = await fn();
    return { value: v, latency: Date.now() - t0, error: null };
  } catch (e) {
    return { value: null, latency: Date.now() - t0, error: e };
  }
}

// ---------- prep mp3 ----------
function prepareMp3() {
  const uploadsDir = join(projectRoot, "public", "uploads");
  if (existsSync(uploadsDir)) {
    const candidates = readdirSync(uploadsDir).filter((f) => f.toLowerCase().endsWith(".mp3"));
    if (candidates.length) {
      // Pick the smallest mp3 to minimise upload size.
      let pick = null;
      let pickSize = Infinity;
      for (const f of candidates) {
        const full = join(uploadsDir, f);
        const sz = statSync(full).size;
        if (sz < pickSize) { pick = full; pickSize = sz; }
      }
      // If smallest is still > 200KB, trim it to 1s with ffmpeg for cheap upload.
      if (pickSize > 200 * 1024) {
        const trimmed = join(projectRoot, "scripts", "_smoke-trim.mp3");
        try {
          execSync(`ffmpeg -y -i "${pick}" -t 1 -ac 1 -ar 22050 "${trimmed}"`, { stdio: "pipe" });
          if (existsSync(trimmed)) return { path: trimmed, source: "trimmed-from-existing" };
        } catch {}
      }
      return { path: pick, source: "existing-upload" };
    }
  }
  // Fall back to generated sine wave.
  const sine = join(projectRoot, "scripts", "_smoke-sine.mp3");
  execSync(`ffmpeg -y -f lavfi -i "sine=frequency=440:duration=1" -ac 1 -ar 44100 "${sine}"`, { stdio: "pipe" });
  return { path: sine, source: "generated-sine" };
}

// ---------- 1. OpenAI gpt-4o-audio-preview ----------
async function testOpenAIAudio() {
  const label = "OpenAI audio (chat completions)";
  if (!OPENAI_KEY) { record(label, "SKIP", "-", 0, "key missing"); return; }

  let mp3;
  try {
    mp3 = prepareMp3();
  } catch (e) {
    record(label, "FAIL", "-", 0, `mp3 prep failed: ${e.message}`);
    return;
  }
  const bytes = readFileSync(mp3.path);
  const b64 = bytes.toString("base64");
  console.log(`[audio] using ${mp3.path} (${bytes.length} bytes, source=${mp3.source})`);

  const candidates = [
    "gpt-4o-audio-preview",
    "gpt-4o-audio-preview-2024-12-17",
    "gpt-4o-audio",
    "gpt-audio",
  ];

  let workedModel = null;
  for (const model of candidates) {
    const body = {
      model,
      modalities: ["text"],
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "What do you hear in one sentence?" },
            { type: "input_audio", input_audio: { data: b64, format: "mp3" } },
          ],
        },
      ],
      max_completion_tokens: 60,
    };
    const r = await timed(() =>
      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    );
    if (r.error) {
      record(`${label} [${model}]`, "FAIL", model, r.latency, `network: ${r.error.message}`);
      continue;
    }
    const res = r.value;
    const text = await res.text();
    if (res.ok) {
      let assistant = "";
      try {
        const j = JSON.parse(text);
        assistant = j?.choices?.[0]?.message?.content || "";
      } catch {}
      record(`${label} [${model}]`, `PASS ${res.status}`, model, r.latency, assistant || snip(text));
      workedModel = model;
      break;
    } else {
      // Detect "model not found / unsupported" → try next; otherwise stop.
      let errMsg = "";
      try {
        const j = JSON.parse(text);
        errMsg = j?.error?.message || j?.error?.code || "";
      } catch { errMsg = text; }
      const looksLikeModelIssue = /model/i.test(errMsg) && /(does not exist|not found|invalid|unsupported|access)/i.test(errMsg);
      record(`${label} [${model}]`, `FAIL ${res.status}`, model, r.latency, snip(errMsg || text));
      if (!looksLikeModelIssue) break;
    }
  }
  if (workedModel) console.log(`[audio] confirmed working model: ${workedModel}`);
}

// ---------- 2. OpenAI text-only ----------
async function testOpenAIText() {
  const label = "OpenAI text (gpt-4o-mini)";
  if (!OPENAI_KEY) { record(label, "SKIP", "gpt-4o-mini", 0, "key missing"); return; }
  const r = await timed(() =>
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: "hello" }],
        max_completion_tokens: 20,
      }),
    })
  );
  if (r.error) { record(label, "FAIL", "gpt-4o-mini", r.latency, `network: ${r.error.message}`); return; }
  const text = await r.value.text();
  let assistant = "";
  try { assistant = JSON.parse(text)?.choices?.[0]?.message?.content || ""; } catch {}
  record(label, `${r.value.ok ? "PASS" : "FAIL"} ${r.value.status}`, "gpt-4o-mini", r.latency, assistant || snip(text));
}

// ---------- 3. ElevenLabs Music ----------
async function testElevenMusic() {
  const label = "ElevenLabs Music";
  if (!ELEVEN_KEY) { record(label, "SKIP", "music", 0, "key missing"); return; }
  const r = await timed(() =>
    fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: "soft lo-fi bossa, brushed drums",
        music_length_ms: 10000,
      }),
    })
  );
  if (r.error) { record(label, "FAIL", "music", r.latency, `network: ${r.error.message}`); return; }
  const res = r.value;
  const ct = res.headers.get("content-type") || "";
  const cl = res.headers.get("content-length") || "";
  if (res.ok) {
    // Pull bytes to confirm audio came back, but don't write to disk.
    const buf = Buffer.from(await res.arrayBuffer());
    const ok = buf.length > 1000;
    record(label, `${ok ? "PASS" : "FAIL"} ${res.status}`, "music", r.latency,
      `ct=${ct} len=${buf.length} (declared ${cl})`);
  } else {
    const text = await res.text();
    record(label, `FAIL ${res.status}`, "music", r.latency, snip(text));
  }
}

// ---------- 4. ElevenLabs Sound Effects ----------
async function testElevenSfx() {
  const label = "ElevenLabs SFX";
  if (!ELEVEN_KEY) { record(label, "SKIP", "sound-generation", 0, "key missing"); return; }
  const r = await timed(() =>
    fetch("https://api.elevenlabs.io/v1/sound-generation", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVEN_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: "espresso machine hiss",
        duration_seconds: 2,
      }),
    })
  );
  if (r.error) { record(label, "FAIL", "sound-generation", r.latency, `network: ${r.error.message}`); return; }
  const res = r.value;
  const ct = res.headers.get("content-type") || "";
  if (res.ok) {
    const buf = Buffer.from(await res.arrayBuffer());
    const ok = buf.length > 1000;
    record(label, `${ok ? "PASS" : "FAIL"} ${res.status}`, "sound-generation", r.latency,
      `ct=${ct} len=${buf.length}`);
  } else {
    const text = await res.text();
    record(label, `FAIL ${res.status}`, "sound-generation", r.latency, snip(text));
  }
}

// ---------- 5. Fal Veo text-to-video ----------
async function testFalVeoT2V() {
  const label = "Fal Veo3 Fast (t2v)";
  if (!FAL_KEY) { record(label, "SKIP", "veo3/fast", 0, "key missing"); return; }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  const r = await timed(async () => {
    try {
      return await fetch("https://fal.run/fal-ai/veo3/fast", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "a cat",
          aspect_ratio: "16:9",
          duration: "8s",
          generate_audio: false,
          resolution: "720p",
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  });
  if (r.error) {
    // AbortError after queue acceptance is the success path here.
    const isAbort = r.error.name === "AbortError" || /abort/i.test(r.error.message || "");
    record(label, isAbort ? "AUTH_OK (aborted)" : "FAIL", "veo3/fast", r.latency,
      isAbort ? "request aborted at 5s — auth accepted, generation killed" : `network: ${r.error.message}`);
    return;
  }
  const res = r.value;
  const text = await res.text();
  // 401/403 = auth failed; 422 = bad shape but auth ok; 2xx = generation actually completed (cost!).
  let tag = `${res.ok ? "PASS" : "FAIL"} ${res.status}`;
  if (res.status === 401 || res.status === 403) tag = `AUTH_FAIL ${res.status}`;
  if (res.status === 422) tag = `AUTH_OK (422 shape)`;
  record(label, tag, "veo3/fast", r.latency, snip(text));
}

// ---------- 6. Fal Veo image-to-video ----------
async function testFalVeoI2V() {
  const label = "Fal Veo3 Fast (i2v)";
  if (!FAL_KEY) { record(label, "SKIP", "veo3/fast/image-to-video", 0, "key missing"); return; }
  // 1x1 transparent PNG.
  const onePxPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const dataUri = `data:image/png;base64,${onePxPng}`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 5000);
  const r = await timed(async () => {
    try {
      return await fetch("https://fal.run/fal-ai/veo3/fast/image-to-video", {
        method: "POST",
        headers: {
          Authorization: `Key ${FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: "a cat",
          image_url: dataUri,
          aspect_ratio: "16:9",
          duration: "8s",
          generate_audio: false,
          resolution: "720p",
        }),
        signal: ac.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  });
  if (r.error) {
    const isAbort = r.error.name === "AbortError" || /abort/i.test(r.error.message || "");
    record(label, isAbort ? "AUTH_OK (aborted)" : "FAIL", "veo3/fast/image-to-video", r.latency,
      isAbort ? "request aborted at 5s — auth accepted, generation killed" : `network: ${r.error.message}`);
    return;
  }
  const res = r.value;
  const text = await res.text();
  let tag = `${res.ok ? "PASS" : "FAIL"} ${res.status}`;
  if (res.status === 401 || res.status === 403) tag = `AUTH_FAIL ${res.status}`;
  if (res.status === 422) tag = `AUTH_OK (422 shape)`;
  record(label, tag, "veo3/fast/image-to-video", r.latency, snip(text));
}

// ---------- runner ----------
(async () => {
  await testOpenAIAudio();
  await testOpenAIText();
  await testElevenMusic();
  await testElevenSfx();
  await testFalVeoT2V();
  await testFalVeoI2V();

  console.log("\n=== RESULTS ===");
  for (const r of results) {
    console.log(`- [${r.status}] ${r.endpoint}  model=${r.modelOrId}  ${r.latency_ms}ms`);
    if (r.snippet) console.log(`    ${r.snippet}`);
  }
  console.log("\n=== JSON TABLE ===");
  console.log(JSON.stringify(results, null, 2));
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
