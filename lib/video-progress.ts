// In-memory progress tracker for video generation. Polled by the
// studio UI every 2 seconds while a render is in flight.
//
// The Map is hung off globalThis so that Turbopack's cross-bundle
// module duplication (api routes vs RSC vs other api routes) doesn't
// give us two empty Maps that never see each other's writes. One
// process = one Map.

export type VideoStage =
  | "idle"
  | "brief"
  | "veo"
  | "stitch"
  | "done"
  | "error";

export type VideoProgress = {
  vibeId: string;
  stage: VideoStage;
  startedAt: number;
  updatedAt: number;
  // Veo stage telemetry
  veoClipsTotal?: number;
  veoClipsCompleted?: number;
  // Free-text status line shown under the bar
  message?: string;
  error?: string;
};

type GlobalShape = {
  __viberVideoProgress?: Map<string, VideoProgress>;
};
const g = globalThis as unknown as GlobalShape;
const progressMap: Map<string, VideoProgress> = (g.__viberVideoProgress ??=
  new Map<string, VideoProgress>());

export function startProgress(vibeId: string, message?: string): void {
  const now = Date.now();
  progressMap.set(vibeId, {
    vibeId,
    stage: "brief",
    startedAt: now,
    updatedAt: now,
    message: message ?? "preparing creative brief",
  });
}

export function setStage(
  vibeId: string,
  stage: VideoStage,
  patch: Partial<VideoProgress> = {},
): void {
  const cur = progressMap.get(vibeId);
  if (!cur) {
    progressMap.set(vibeId, {
      vibeId,
      stage,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      ...patch,
    });
    return;
  }
  progressMap.set(vibeId, {
    ...cur,
    ...patch,
    stage,
    updatedAt: Date.now(),
  });
}

export function bumpVeoCompleted(vibeId: string, message?: string): void {
  const cur = progressMap.get(vibeId);
  if (!cur) return;
  progressMap.set(vibeId, {
    ...cur,
    veoClipsCompleted: (cur.veoClipsCompleted ?? 0) + 1,
    message: message ?? cur.message,
    updatedAt: Date.now(),
  });
}

export function failProgress(vibeId: string, error: string): void {
  const cur = progressMap.get(vibeId);
  progressMap.set(vibeId, {
    vibeId,
    stage: "error",
    startedAt: cur?.startedAt ?? Date.now(),
    updatedAt: Date.now(),
    error,
    message: error,
  });
}

export function getProgress(vibeId: string): VideoProgress | undefined {
  return progressMap.get(vibeId);
}

export function clearProgress(vibeId: string, delayMs = 0): void {
  if (delayMs <= 0) {
    progressMap.delete(vibeId);
    return;
  }
  setTimeout(() => progressMap.delete(vibeId), delayMs);
}

// Maps stage + clip telemetry to a 0..100 percent so the UI doesn't
// have to know our weighting. Brief is 0–5, veo is 5–90, stitch is
// 90–99, done is 100, error stays where it failed.
export function computePercent(p: VideoProgress): number {
  switch (p.stage) {
    case "idle":
      return 0;
    case "brief":
      return 5;
    case "veo": {
      const total = p.veoClipsTotal ?? 1;
      const done = p.veoClipsCompleted ?? 0;
      return 5 + Math.round((Math.min(done, total) / total) * 85);
    }
    case "stitch":
      return 92;
    case "done":
      return 100;
    case "error":
      return 0;
  }
}
