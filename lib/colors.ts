// Drive page colors from a vibe's palette. The base paper, the secondary
// paper for cards, and the accent stamp colour are all derived from the
// palette's HSL distribution. Smooth crossfade via CSS transitions on
// :root variables.

export type PaletteHex = string[];

export function applyVibePalette(hexes: PaletteHex, accent?: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!hexes.length) return;

  const hsls = hexes.map(hexToHsl);

  // Pick a hue family: dominant by saturation × area approximation.
  // We just take the most-saturated for the accent, the lightest for paper.
  const sortedByLight = [...hsls].sort((a, b) => b.l - a.l);
  const sortedBySat = [...hsls].sort((a, b) => b.s - a.s);

  const lightest = sortedByLight[0];
  const mostSat = sortedBySat[0];

  // Paper: same hue as lightest, low saturation, very high lightness.
  const paper = hslToHex({
    h: lightest.h,
    s: clamp(lightest.s * 0.55 + 0.06, 0.06, 0.28),
    l: clamp(0.92, 0.88, 0.95),
  });
  const paperHi = hslToHex({
    h: lightest.h,
    s: clamp(lightest.s * 0.4 + 0.04, 0.04, 0.2),
    l: 0.97,
  });

  // Stamp: most saturated palette hue, dialled to a deep editorial red-ish.
  const stamp = accent
    ? accent
    : hslToHex({
        h: mostSat.h,
        s: clamp(Math.max(mostSat.s, 0.55), 0.55, 0.85),
        l: clamp(mostSat.l < 0.5 ? mostSat.l + 0.1 : mostSat.l - 0.15, 0.32, 0.5),
      });

  const stampHsl = hexToHsl(stamp);
  const stampInk = hslToHex({ h: stampHsl.h, s: stampHsl.s, l: clamp(stampHsl.l - 0.15, 0.18, 0.4) });

  root.style.setProperty("--vibe-paper", paper);
  root.style.setProperty("--vibe-paper-hi", paperHi);
  root.style.setProperty("--vibe-stamp", stamp);
  root.style.setProperty("--vibe-stamp-ink", stampInk);

  // Three radial tints for atmospheric layering on top of the paper.
  root.style.setProperty("--vibe-tint-1", withAlpha(hexes[0] ?? paper, 0.22));
  root.style.setProperty("--vibe-tint-2", withAlpha(hexes[1] ?? paper, 0.18));
  root.style.setProperty(
    "--vibe-tint-3",
    withAlpha(hexes[2] ?? hexes[0] ?? paper, 0.14),
  );
}

export function resetVibePalette() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const v of [
    "--vibe-paper",
    "--vibe-paper-hi",
    "--vibe-stamp",
    "--vibe-stamp-ink",
    "--vibe-tint-1",
    "--vibe-tint-2",
    "--vibe-tint-3",
  ]) {
    root.style.removeProperty(v);
  }
}

// ---------- color math ----------

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function withAlpha(hex: string, alpha: number): string {
  const v = hex.replace("#", "");
  const r = parseInt(v.substring(0, 2), 16);
  const g = parseInt(v.substring(2, 4), 16);
  const b = parseInt(v.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

type Hsl = { h: number; s: number; l: number };

function hexToHsl(hex: string): Hsl {
  const v = hex.replace("#", "");
  const r = parseInt(v.substring(0, 2), 16) / 255;
  const g = parseInt(v.substring(2, 4), 16) / 255;
  const b = parseInt(v.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToHex({ h, s, l }: Hsl): string {
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hueToRgb(p, q, h + 1 / 3);
    g = hueToRgb(p, q, h);
    b = hueToRgb(p, q, h - 1 / 3);
  }
  const toHex = (n: number) =>
    Math.round(n * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hueToRgb(p: number, q: number, t: number) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}
