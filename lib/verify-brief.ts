// Chain-of-Verification (COVE) layer that runs AFTER buildCreativeBrief.
// Layer 1 is deterministic, free, and catches the common failure modes
// (subject ungrounded, shots that don't reuse subject nouns, hero motion
// with too few events, music prompt that drifted off the source audio,
// chain prompts missing the camera-locked sign-off). Only when Layer 1
// flags something do we spend tokens on Layer 2 — a per-field repair via
// gpt-4o-mini using structured output.

import OpenAI from "openai";
import type { AudioAnalysis, CreativeBrief, VibeObject } from "./types";

const REPAIR_MODEL = process.env.VIBER_BRIEF_REPAIR_MODEL || "gpt-4o-mini";

const CAMERA_SIGNOFF = "Camera locked off. Documentary footage, not music video.";
const NO_AUDIO_PHRASE = "[no source audio analysis]";

const STOPWORDS = new Set([
  "a","an","the","and","or","but","of","on","in","at","to","from","by","with",
  "for","as","is","are","was","were","be","been","being","this","that","these",
  "those","it","its","into","over","under","up","down","out","off","very","just",
  "than","then","also","too","so","such","while","where","when","what","who",
  "which","whose","there","here","one","two","three","some","any","all","each",
  "every","no","not","near","next","onto","upon","across","through","between",
  "around","about","above","below","beside","behind","front","back","side",
  "his","her","their","our","my","your","you","they","we","he","she","them","us",
  "still","quiet","empty","alive","moving","feels","feel","seems","seem","look",
  "looks","barely","slightly","gently","softly","slowly","almost","like","as",
]);

type CheckResult = { field: string; ok: boolean; why?: string };

type ShotCheckResult = CheckResult & { index?: number };

type CheckReport = {
  subject: CheckResult;
  shots: ShotCheckResult[];
  heroMotion: CheckResult;
  musicPrompt: CheckResult;
  chainPrompts: CheckResult;
};

function lc(s: string): string {
  return (s || "").toLowerCase();
}

function tokens(s: string): string[] {
  return lc(s)
    .replace(/[^a-z0-9#\s-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Pull "noun-ish" candidates out of the subject paragraph: 3+ char words
// that aren't stopwords. Multi-word phrases handled by also keeping
// adjacent pairs that survive the same filter — this catches things like
// "ceramic cup" or "pendant lamp" that single-token matching would miss.
function subjectNounCandidates(subject: string): string[] {
  const raw = tokens(subject).filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w),
  );
  const phrases: string[] = [...raw];
  for (let i = 0; i < raw.length - 1; i++) {
    phrases.push(`${raw[i]} ${raw[i + 1]}`);
  }
  return Array.from(new Set(phrases));
}

// ---------- Layer 1: programmatic checks ----------

function checkSubjectGrounded(
  vibe: VibeObject,
  brief: CreativeBrief,
): CheckResult {
  const subj = lc(brief.subject || "");
  if (!subj.trim()) {
    return { field: "subject", ok: false, why: "subject is empty" };
  }

  const lightingWords = tokens(vibe.lighting || "").filter(
    (w) => w.length >= 3 && !STOPWORDS.has(w),
  );
  const motifWords = (vibe.visualMotifs || [])
    .flatMap((m) => tokens(m))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
  const hexes = (vibe.palette || [])
    .map((p) => lc(p.hex || ""))
    .filter((h) => h.startsWith("#"));

  const wordHits = [...lightingWords, ...motifWords].some((w) =>
    subj.includes(w),
  );
  const hexHits = hexes.some((h) => subj.includes(h));

  if (wordHits || hexHits) {
    return { field: "subject", ok: true };
  }
  return {
    field: "subject",
    ok: false,
    why: "subject mentions no lighting word, palette hex, or visualMotif noun",
  };
}

function checkShotsCiteProps(brief: CreativeBrief): ShotCheckResult[] {
  const candidates = subjectNounCandidates(brief.subject || "");
  const shots = brief.shots || [];
  return shots.map((shot, index) => {
    const desc = lc(shot.description || "");
    if (!desc.trim()) {
      return {
        field: "shots",
        index,
        ok: false,
        why: "shot description is empty",
      };
    }
    const hit = candidates.some((c) => c.length >= 3 && desc.includes(c));
    return hit
      ? { field: "shots", index, ok: true }
      : {
          field: "shots",
          index,
          ok: false,
          why: "no noun phrase from subject reused verbatim",
        };
  });
}

function checkHeroMotionEvents(brief: CreativeBrief): CheckResult {
  const motion = brief.heroShot?.motion || "";
  if (!motion.trim()) {
    return { field: "heroMotion", ok: false, why: "motion is empty" };
  }
  // Split on ; or , or " and ". Three or more non-empty clauses required.
  const clauses = motion
    .split(/;|,| and /i)
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length >= 3) {
    return { field: "heroMotion", ok: true };
  }
  return {
    field: "heroMotion",
    ok: false,
    why: `motion has only ${clauses.length} clause(s), need >= 3`,
  };
}

function checkMusicPromptCitesAudio(
  vibe: VibeObject,
  brief: CreativeBrief,
): CheckResult {
  const prompt = brief.musicPrompt || "";
  const audio = vibe.audioAnalysis;

  if (!audio || !audio.hasMusic) {
    if (prompt.includes(NO_AUDIO_PHRASE)) {
      return { field: "musicPrompt", ok: true };
    }
    return {
      field: "musicPrompt",
      ok: false,
      why: `hasMusic=false but musicPrompt missing literal "${NO_AUDIO_PHRASE}"`,
    };
  }

  const tempo = audio.tempoBpm;
  const tempoRe = new RegExp(`\\b${tempo}\\b`);
  if (!tempoRe.test(prompt)) {
    return {
      field: "musicPrompt",
      ok: false,
      why: `musicPrompt missing tempoBpm=${tempo} verbatim`,
    };
  }

  const key = (audio.key || "").trim();
  if (key && lc(key) !== "unclear" && !prompt.includes(key)) {
    return {
      field: "musicPrompt",
      ok: false,
      why: `musicPrompt missing key="${key}" verbatim`,
    };
  }

  // 2-of-3 instrument threshold: ElevenLabs prompts get cluttered when we
  // force-cite all three, and the third instrument from audioAnalysis is
  // often a percussion fragment that doesn't fit the [REFERENCE] template
  // cleanly. Two citations are enough to anchor the source.
  const top3 = (audio.instruments || []).slice(0, 3);
  if (top3.length > 0) {
    const hits = top3.filter((inst) => prompt.includes(inst)).length;
    if (hits < Math.min(2, top3.length)) {
      return {
        field: "musicPrompt",
        ok: false,
        why: `musicPrompt cites only ${hits} of ${top3.length} top instruments (need 2)`,
      };
    }
  }

  return { field: "musicPrompt", ok: true };
}

function checkChainPromptsContinuity(brief: CreativeBrief): CheckResult {
  const chain = brief.chainPrompts || [];
  if (chain.length < 2) {
    return { field: "chainPrompts", ok: true };
  }

  const opener = chain[0] || "";
  const openerLc = lc(opener);
  const forbiddenInOpener = ["picking up", "continuation", "previous clip"];
  for (const phrase of forbiddenInOpener) {
    if (openerLc.includes(phrase)) {
      return {
        field: "chainPrompts",
        ok: false,
        why: `chain[0] contains continuation phrase "${phrase}" but is the opening`,
      };
    }
  }

  const continuationCues = [
    "picking up",
    "continues",
    "continuation",
    "previous clip",
    "from where",
    "from the prior",
  ];
  for (let i = 1; i < chain.length; i++) {
    const lcPrompt = lc(chain[i] || "");
    const has = continuationCues.some((c) => lcPrompt.includes(c));
    if (!has) {
      return {
        field: "chainPrompts",
        ok: false,
        why: `chain[${i}] missing continuation cue (one of: ${continuationCues.join(", ")})`,
      };
    }
  }

  for (let i = 0; i < chain.length; i++) {
    const trimmed = (chain[i] || "").trimEnd();
    if (!trimmed.endsWith(CAMERA_SIGNOFF)) {
      return {
        field: "chainPrompts",
        ok: false,
        why: `chain[${i}] does not end with the literal sign-off`,
      };
    }
  }

  return { field: "chainPrompts", ok: true };
}

function runLayer1(vibe: VibeObject, brief: CreativeBrief): CheckReport {
  return {
    subject: checkSubjectGrounded(vibe, brief),
    shots: checkShotsCiteProps(brief),
    heroMotion: checkHeroMotionEvents(brief),
    musicPrompt: checkMusicPromptCitesAudio(vibe, brief),
    chainPrompts: checkChainPromptsContinuity(brief),
  };
}

// ---------- Layer 2: per-field LLM repairs ----------

async function callRepair<T>(
  client: OpenAI,
  system: string,
  user: string,
  schemaName: string,
  schema: Record<string, unknown>,
): Promise<T> {
  const resp = await client.chat.completions.create({
    model: REPAIR_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: schemaName, schema, strict: true },
    },
  });
  const content = resp.choices[0]?.message?.content;
  if (!content) throw new Error(`repair ${schemaName}: empty content`);
  return JSON.parse(content) as T;
}

const STRING_VALUE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "value"],
  properties: {
    plan: { type: "string" },
    value: { type: "string" },
  },
} as const;

const STRING_ARRAY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["plan", "values"],
  properties: {
    plan: { type: "string" },
    values: { type: "array", items: { type: "string" } },
  },
} as const;

async function repairSubject(
  client: OpenAI,
  vibe: VibeObject,
  brief: CreativeBrief,
): Promise<string> {
  const lightingWords = (vibe.lighting || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 12)
    .join(", ");
  const palette = (vibe.palette || [])
    .map((p) => `${p.name} ${p.hex}`)
    .join(", ");
  const motifs = (vibe.visualMotifs || []).join(", ");

  const system = `You repair one field of a creative brief. Output strict JSON.
"plan": one sentence naming the grounding token you will introduce.
"value": the rewritten subject paragraph, same length as input, same scene.`;

  const user = `Rewrite the subject paragraph so it contains at least one of:
- a word from these lighting cues: ${lightingWords}
- a hex color from this palette (verbatim, including the leading #): ${palette}
- a noun from these visual motifs: ${motifs}

Same length, same scene, no new characters.

Current subject:
${brief.subject}`;

  const out = await callRepair<{ plan: string; value: string }>(
    client,
    system,
    user,
    "RepairSubject",
    STRING_VALUE_SCHEMA as unknown as Record<string, unknown>,
  );
  return out.value.trim();
}

async function repairShot(
  client: OpenAI,
  brief: CreativeBrief,
  index: number,
): Promise<{ index: number; description: string }> {
  const shot = brief.shots[index];
  const system = `You repair one field of a creative brief. Output strict JSON.
"plan": one sentence naming the noun phrase you will reuse.
"value": the rewritten shot description, one sentence, same angle preserved.`;

  const user = `Rewrite this shot description so it contains at least one noun
phrase from this subject paragraph, verbatim. Keep the angle.

Subject paragraph:
${brief.subject}

Current shot description (angle: ${shot.angle}):
${shot.description}`;

  const out = await callRepair<{ plan: string; value: string }>(
    client,
    system,
    user,
    "RepairShot",
    STRING_VALUE_SCHEMA as unknown as Record<string, unknown>,
  );
  return { index, description: out.value.trim() };
}

async function repairHeroMotion(
  client: OpenAI,
  brief: CreativeBrief,
): Promise<string> {
  const system = `You repair one field of a creative brief. Output strict JSON.
"plan": one sentence naming the 3+ events you will list.
"value": the rewritten motion line, semicolon-separated, with timestamps.`;

  const user = `Rewrite this motion so it lists at least 3 distinct events with
rough timestamps (e.g. "0:01 cup placed; 0:04 pour begins; 0:07 finishes").

Current motion:
${brief.heroShot?.motion || ""}`;

  const out = await callRepair<{ plan: string; value: string }>(
    client,
    system,
    user,
    "RepairHeroMotion",
    STRING_VALUE_SCHEMA as unknown as Record<string, unknown>,
  );
  return out.value.trim();
}

async function repairMusicPrompt(
  client: OpenAI,
  vibe: VibeObject,
  brief: CreativeBrief,
): Promise<string> {
  const audio = vibe.audioAnalysis;

  // Fast path: when there's no source audio, the repair is purely a string
  // injection — cheaper to do locally than spend a token round-trip.
  if (!audio || !audio.hasMusic) {
    const current = brief.musicPrompt || "";
    if (current.includes(NO_AUDIO_PHRASE)) return current;
    if (current.includes("[REFERENCE FROM SOURCE]")) {
      return current.replace(
        /\[REFERENCE FROM SOURCE\]\s*/,
        `[REFERENCE FROM SOURCE]\n${NO_AUDIO_PHRASE}\n`,
      );
    }
    return `[REFERENCE FROM SOURCE]\n${NO_AUDIO_PHRASE}\n\n${current}`;
  }

  const top3 = (audio.instruments || []).slice(0, 3);
  const system = `You repair one field of a creative brief. Output strict JSON.
"plan": one sentence naming what you changed.
"value": the rewritten musicPrompt as plain text, preserving the four-section
structure ([REFERENCE FROM SOURCE], [STRUCTURE — 90 seconds], [ROOM CONTEXT],
[RULES]).`;

  const user = `Rewrite this music prompt so the [REFERENCE FROM SOURCE]
section cites:
- tempoBpm=${audio.tempoBpm} verbatim (as the integer ${audio.tempoBpm})
- key=${audio.key} verbatim
- these instruments verbatim, in order: ${top3.join(", ")}

Keep the rest of the structure (STRUCTURE, ROOM CONTEXT, RULES sections) intact.
Do not invent new tempos or instruments.

Current prompt:
${brief.musicPrompt || ""}`;

  const out = await callRepair<{ plan: string; value: string }>(
    client,
    system,
    user,
    "RepairMusicPrompt",
    STRING_VALUE_SCHEMA as unknown as Record<string, unknown>,
  );
  return out.value.trim();
}

// chainPrompts is regenerated as a whole batch instead of per-clip because
// continuity across clips is the whole point: a per-clip repair would
// reference the OLD broken neighbour, so fixing clip 2 in isolation can
// produce a chain whose internal narrative no longer flows.
async function repairChainPrompts(
  client: OpenAI,
  brief: CreativeBrief,
): Promise<string[]> {
  const count = (brief.chainPrompts || []).length || 4;
  const system = `You repair one field of a creative brief. Output strict JSON.
"plan": 1-2 sentences sketching the arc.
"values": exactly ${count} prompt strings.

Rules:
- values[0] is the OPENING — it must NOT contain "picking up", "continuation",
  or "previous clip".
- values[1..n-1] each must contain ONE of: "picking up", "continues",
  "continuation", "previous clip", "from where", "from the prior".
- EVERY prompt must end with the literal sentence:
  "${CAMERA_SIGNOFF}"`;

  const user = `Regenerate the 4-clip chain. Restate the same location and 2
specific props verbatim across all clips. Each clip names 3 motion events
with rough timestamps. Each clip ends with the camera-locked sign-off.

Subject:
${brief.subject}

Hero shot description: ${brief.heroShot?.description || ""}
Hero shot motion: ${brief.heroShot?.motion || ""}

Shots (for prop continuity):
${JSON.stringify(brief.shots || [], null, 2)}

Current (broken) chainPrompts:
${JSON.stringify(brief.chainPrompts || [], null, 2)}`;

  const out = await callRepair<{ plan: string; values: string[] }>(
    client,
    system,
    user,
    "RepairChainPrompts",
    STRING_ARRAY_SCHEMA as unknown as Record<string, unknown>,
  );
  return out.values.slice(0, count);
}

// ---------- Orchestrator ----------

function summarizeFailures(report: CheckReport): string[] {
  const out: string[] = [];
  if (!report.subject.ok) out.push(`subject: ${report.subject.why}`);
  for (const s of report.shots) {
    if (!s.ok) out.push(`shots[${s.index}]: ${s.why}`);
  }
  if (!report.heroMotion.ok) out.push(`heroMotion: ${report.heroMotion.why}`);
  if (!report.musicPrompt.ok) out.push(`musicPrompt: ${report.musicPrompt.why}`);
  if (!report.chainPrompts.ok)
    out.push(`chainPrompts: ${report.chainPrompts.why}`);
  return out;
}

export async function verifyAndRepairBrief(
  vibe: VibeObject,
  brief: CreativeBrief,
): Promise<CreativeBrief> {
  const report = runLayer1(vibe, brief);
  const failures = summarizeFailures(report);

  if (failures.length === 0) {
    return brief;
  }

  console.warn(
    `[verify-brief] Layer 1 found ${failures.length} issue(s):\n  - ${failures.join("\n  - ")}`,
  );

  if (!process.env.OPENAI_API_KEY) {
    console.warn("[verify-brief] OPENAI_API_KEY missing, skipping Layer 2");
    return brief;
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  type RepairKind =
    | { kind: "subject"; promise: Promise<string> }
    | {
        kind: "shot";
        promise: Promise<{ index: number; description: string }>;
      }
    | { kind: "heroMotion"; promise: Promise<string> }
    | { kind: "musicPrompt"; promise: Promise<string> }
    | { kind: "chainPrompts"; promise: Promise<string[]> };

  const tasks: RepairKind[] = [];

  if (!report.subject.ok) {
    tasks.push({ kind: "subject", promise: repairSubject(client, vibe, brief) });
  }
  for (const s of report.shots) {
    if (!s.ok && typeof s.index === "number") {
      tasks.push({
        kind: "shot",
        promise: repairShot(client, brief, s.index),
      });
    }
  }
  if (!report.heroMotion.ok) {
    tasks.push({ kind: "heroMotion", promise: repairHeroMotion(client, brief) });
  }
  if (!report.musicPrompt.ok) {
    tasks.push({
      kind: "musicPrompt",
      promise: repairMusicPrompt(client, vibe, brief),
    });
  }
  if (!report.chainPrompts.ok) {
    tasks.push({
      kind: "chainPrompts",
      promise: repairChainPrompts(client, brief),
    });
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));

  const repaired: CreativeBrief = {
    ...brief,
    shots: brief.shots.map((s) => ({ ...s })),
    heroShot: { ...brief.heroShot },
    chainPrompts: brief.chainPrompts ? [...brief.chainPrompts] : undefined,
  };

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const result = settled[i];
    if (result.status === "rejected") {
      console.warn(
        `[verify-brief] repair ${task.kind} failed: ${result.reason}; keeping original`,
      );
      continue;
    }
    const value = result.value;
    if (task.kind === "subject" && typeof value === "string") {
      repaired.subject = value;
    } else if (
      task.kind === "shot" &&
      value &&
      typeof value === "object" &&
      "index" in (value as object)
    ) {
      const v = value as { index: number; description: string };
      if (repaired.shots[v.index]) {
        repaired.shots[v.index] = {
          ...repaired.shots[v.index],
          description: v.description,
        };
      }
    } else if (task.kind === "heroMotion" && typeof value === "string") {
      repaired.heroShot = { ...repaired.heroShot, motion: value };
    } else if (task.kind === "musicPrompt" && typeof value === "string") {
      repaired.musicPrompt = value;
    } else if (task.kind === "chainPrompts" && Array.isArray(value)) {
      repaired.chainPrompts = value as string[];
    }
  }

  // Single-round policy: re-run Layer 1 once on the repaired brief and log
  // remaining failures, but do NOT repair again. Two rounds rarely help and
  // they double the worst-case cost.
  const recheck = runLayer1(vibe, repaired);
  const remaining = summarizeFailures(recheck);
  if (remaining.length > 0) {
    console.warn(
      `[verify-brief] ${remaining.length} issue(s) remain after repair (not retrying):\n  - ${remaining.join("\n  - ")}`,
    );
  } else {
    console.log("[verify-brief] all checks pass after repair");
  }

  return repaired;
}

export const __test = {
  runLayer1,
  subjectNounCandidates,
};
