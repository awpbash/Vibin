// Gemini API helpers — Veo (video), Nano Banana 2 (image), Lyria 3
// (music). Used as fallbacks for the Fal and OpenAI paths and as the
// optional alt for ElevenLabs.
//
// Auth: x-goog-api-key header.
// Veo  is async via predictLongRunning + polling.
// Nano Banana 2 is sync via :generateContent with IMAGE modality.
// Lyria 3 is sync via :generateContent with AUDIO modality.
//
// Cost (May 2026, approximate):
//   Veo 3.1 Fast (with audio):       ~$0.15 / second
//   Veo 3.1 Standard:                ~$0.40 / second
//   Nano Banana 2 (Gemini 3.1 Image):~$0.04 / image
//   Lyria 3 Clip:                    ~$0.06 / 30 second clip
//   Lyria 3 Pro:                     ~$0.20 / 30 second clip

const BASE = "https://generativelanguage.googleapis.com/v1beta";

const VEO_MODEL =
  process.env.VIBER_GEMINI_VEO_MODEL || "veo-3.1-fast-generate-preview";
const IMAGE_MODEL =
  process.env.VIBER_GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
const LYRIA_MODEL =
  process.env.VIBER_GEMINI_LYRIA_MODEL || "lyria-3-clip-preview";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY missing");
  return k;
}

// ---------- Veo ----------

export type VeoOptions = {
  prompt: string;
  durationSeconds?: number; // 4, 6, 8 typical
  aspectRatio?: string;     // "16:9" | "9:16"
  generateAudio?: boolean;
  resolution?: string;      // "720p"
  pollMs?: number;          // poll interval
  maxWaitMs?: number;       // total wait cap
  // First-frame anchor for image-to-video continuation. PNG/JPEG bytes.
  // When provided, the clip begins from this exact frame — used to
  // chain clips into one continuous take.
  firstFrame?: { mimeType: string; dataBase64: string };
  // Optional last-frame anchor for first/last interpolation. When
  // both firstFrame and lastFrame are set, Veo interpolates a clip
  // that begins at firstFrame and ends at lastFrame — this is how we
  // make the chain loop back to the opening frame.
  lastFrame?: { mimeType: string; dataBase64: string };
};

export async function generateVeoVideoBytes(opts: VeoOptions): Promise<Buffer> {
  const k = key();
  const instance: Record<string, unknown> = { prompt: opts.prompt };
  if (opts.firstFrame) {
    instance.image = {
      inlineData: {
        mimeType: opts.firstFrame.mimeType,
        data: opts.firstFrame.dataBase64,
      },
    };
  }
  if (opts.lastFrame) {
    instance.lastFrame = {
      inlineData: {
        mimeType: opts.lastFrame.mimeType,
        data: opts.lastFrame.dataBase64,
      },
    };
  }
  const submitBody = {
    instances: [instance],
    parameters: {
      aspectRatio: opts.aspectRatio ?? "16:9",
      durationSeconds: opts.durationSeconds ?? 8,
      generateAudio: opts.generateAudio ?? true,
      resolution: opts.resolution ?? "720p",
      sampleCount: 1,
    },
  };

  // 1. Submit
  const submitRes = await fetch(
    `${BASE}/models/${VEO_MODEL}:predictLongRunning`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": k,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(submitBody),
    },
  );
  if (!submitRes.ok) {
    const text = await submitRes.text().catch(() => "");
    throw new Error(`gemini veo submit ${submitRes.status}: ${text.slice(0, 600)}`);
  }
  const submit = (await submitRes.json()) as { name?: string };
  const operationName = submit.name;
  if (!operationName) throw new Error("gemini veo: no operation name returned");

  // 2. Poll
  type Op = {
    name?: string;
    done?: boolean;
    error?: { code?: number; message?: string };
    response?: {
      generateVideoResponse?: {
        generatedSamples?: Array<{ video?: { uri?: string } }>;
        generatedVideos?: Array<{ video?: { uri?: string } }>;
      };
    };
  };

  const pollMs = opts.pollMs ?? 5000;
  const maxWait = opts.maxWaitMs ?? 4 * 60 * 1000;
  const start = Date.now();
  let op: Op = {};

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, pollMs));
    const pollRes = await fetch(`${BASE}/${operationName}`, {
      headers: { "x-goog-api-key": k },
    });
    if (!pollRes.ok) {
      const text = await pollRes.text().catch(() => "");
      throw new Error(`gemini veo poll ${pollRes.status}: ${text.slice(0, 400)}`);
    }
    op = (await pollRes.json()) as Op;
    if (op.done) break;
  }

  if (!op.done) throw new Error("gemini veo polling timed out");
  if (op.error)
    throw new Error(`gemini veo error: ${op.error.message ?? "unknown"}`);

  const samples =
    op.response?.generateVideoResponse?.generatedSamples ??
    op.response?.generateVideoResponse?.generatedVideos ??
    [];
  const uri = samples[0]?.video?.uri;
  if (!uri) throw new Error("gemini veo: no video uri in response");

  // 3. Download. The uri may already include params; append key correctly.
  const sep = uri.includes("?") ? "&" : "?";
  const downloadUrl = `${uri}${sep}key=${k}`;
  const dl = await fetch(downloadUrl);
  if (!dl.ok) {
    const text = await dl.text().catch(() => "");
    throw new Error(`gemini veo download ${dl.status}: ${text.slice(0, 200)}`);
  }
  const ab = await dl.arrayBuffer();
  return Buffer.from(ab);
}

// ---------- Nano Banana 2 (Gemini 3.1 Flash Image) ----------

export type ImageOptions = {
  prompt: string;
  aspectRatio?: string;     // "16:9" | "1:1"
};

// Generates a still using Gemini 3.1 Flash Image (Nano Banana 2). Uses
// the multimodal generateContent endpoint with IMAGE response modality.
// Returns raw image bytes (PNG by default).
export async function generateGeminiImageBytes(
  opts: ImageOptions,
): Promise<Buffer> {
  const k = key();
  const body: Record<string, unknown> = {
    contents: [
      {
        role: "user",
        parts: [{ text: opts.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
      ...(opts.aspectRatio
        ? { imageConfig: { aspectRatio: opts.aspectRatio } }
        : {}),
    },
  };

  const res = await fetch(`${BASE}/models/${IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": k,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`gemini image ${res.status}: ${text.slice(0, 600)}`);
  }

  type Resp = {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inline_data?: { mime_type?: string; data?: string };
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const data = (await res.json()) as Resp;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const b64 = p.inline_data?.data ?? p.inlineData?.data;
    if (b64) return Buffer.from(b64, "base64");
  }
  throw new Error("gemini image: no inline_data in response");
}

// Backwards-compat alias for older imports. The fallback chain in
// generate.ts used to call Imagen; now it calls Nano Banana 2.
export async function generateImagenBytes(opts: {
  prompt: string;
  aspectRatio?: string;
  sampleCount?: number;
}): Promise<Buffer> {
  return generateGeminiImageBytes({
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
  });
}

// ---------- Lyria 3 (music) ----------

export type LyriaOptions = {
  prompt: string;
  // lyria-3-clip default output is mp3. Pro can also do wav.
  responseMimeType?: "audio/mp3" | "audio/wav";
};

export async function generateLyriaMusicBytes(
  opts: LyriaOptions,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const k = key();
  const responseMimeType = opts.responseMimeType ?? "audio/mp3";

  const body = {
    contents: [
      {
        role: "user",
        parts: [{ text: opts.prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO", "TEXT"],
      responseMimeType,
    },
  };

  const res = await fetch(`${BASE}/models/${LYRIA_MODEL}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": k,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`lyria ${res.status}: ${text.slice(0, 600)}`);
  }

  type Resp = {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inline_data?: { mime_type?: string; data?: string };
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  const data = (await res.json()) as Resp;
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    const b64 = p.inline_data?.data ?? p.inlineData?.data;
    const mime =
      p.inline_data?.mime_type ?? p.inlineData?.mimeType ?? responseMimeType;
    if (b64) return { buffer: Buffer.from(b64, "base64"), mimeType: mime };
  }
  throw new Error("lyria: no inline_data in response");
}
