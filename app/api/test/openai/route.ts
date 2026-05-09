import { NextResponse } from "next/server";
import OpenAI from "openai";
import { estimateCost } from "@/lib/pricing";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL_CHAIN = [
  process.env.OPENAI_VISION_MODEL || "gpt-5.4-mini",
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-4o-mini",
  "gpt-4o",
];

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "OPENAI_API_KEY missing" },
      { status: 500 },
    );
  }

  let body: { prompt?: string; imageUrl?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body, defaults below
  }

  const prompt =
    body.prompt ??
    "In one sentence, in the voice of a small magazine editor, describe the vibe of this image. Be specific. Avoid 'cozy' and 'aesthetic'.";
  const imageUrl =
    body.imageUrl ??
    "https://images.unsplash.com/photo-1453614512568-c4024d13c247?auto=format&fit=crop&w=1200&q=70";

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const seen: Array<{ model: string; error: string }> = [];

  for (const model of dedupe(MODEL_CHAIN)) {
    const t0 = performance.now();
    try {
      const resp = await client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: "Reply with one tight, specific sentence." },
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        max_completion_tokens: 200,
      });
      const ms = Math.round(performance.now() - t0);
      const cost = estimateCost(model, resp.usage as never);
      return NextResponse.json({
        ok: true,
        model,
        durationMs: ms,
        prompt,
        imageUrl,
        response: resp.choices[0]?.message?.content ?? "",
        usage: resp.usage,
        cost,
        triedFallbacks: seen,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      seen.push({ model, error: truncate(msg, 240) });
      // Only fall through on model-not-found / 404. Hard errors stop here.
      if (!/model.*does not exist|not found|invalid model|404/i.test(msg)) {
        return NextResponse.json(
          { ok: false, error: msg, triedFallbacks: seen },
          { status: 500 },
        );
      }
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: "no available model in chain",
      triedFallbacks: seen,
    },
    { status: 500 },
  );
}

function dedupe<T>(xs: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const x of xs) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + "..." : s;
}
