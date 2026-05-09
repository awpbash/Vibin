"use client";

import Link from "next/link";
import { useState } from "react";

// Map config — virtual viewport is 800×500, scaled responsively via aspect-ratio.
const VIEWPORT_W = 800;
const VIEWPORT_H = 500;
const ZOOM = 14;
const CENTER = { lat: 1.290, lng: 103.829 };

type Spot = {
  id: string;
  num: string;
  name: string;
  area: string;
  vibe: string;
  thumb: string;
  lat: number;
  lng: number;
  rotate: string;
};

const SPOTS: Spot[] = [
  {
    id: "v-moy4b7c0-x23j",
    num: "01",
    name: "rooftop brunch",
    area: "tanjong pagar",
    vibe: "sunlit · disco ball · midday",
    thumb:
      "https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=320&q=70",
    lat: 1.2772,
    lng: 103.8458,
    rotate: "2deg",
  },
  {
    id: "v-moy6k90j-bog5",
    num: "02",
    name: "amber brass",
    area: "chinatown",
    vibe: "stone room · muted trumpet · afternoon",
    thumb:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=320&q=70",
    lat: 1.2837,
    lng: 103.8443,
    rotate: "-3deg",
  },
];

// Web-Mercator world-pixel coords (256-pixel tile space) at given zoom.
function lngToPx(lng: number, z: number): number {
  return ((lng + 180) / 360) * Math.pow(2, z) * 256;
}
function latToPx(lat: number, z: number): number {
  const sin = Math.sin((lat * Math.PI) / 180);
  return (
    (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) *
    Math.pow(2, z) *
    256
  );
}

const CENTER_WX = lngToPx(CENTER.lng, ZOOM);
const CENTER_WY = latToPx(CENTER.lat, ZOOM);
const ORIGIN_WX = CENTER_WX - VIEWPORT_W / 2;
const ORIGIN_WY = CENTER_WY - VIEWPORT_H / 2;

// Tile grid covering the viewport.
const TILES = (() => {
  const txMin = Math.floor(ORIGIN_WX / 256);
  const txMax = Math.floor((ORIGIN_WX + VIEWPORT_W) / 256);
  const tyMin = Math.floor(ORIGIN_WY / 256);
  const tyMax = Math.floor((ORIGIN_WY + VIEWPORT_H) / 256);
  const out: Array<{ x: number; y: number; px: number; py: number }> = [];
  for (let tx = txMin; tx <= txMax; tx++) {
    for (let ty = tyMin; ty <= tyMax; ty++) {
      out.push({
        x: tx,
        y: ty,
        px: tx * 256 - ORIGIN_WX,
        py: ty * 256 - ORIGIN_WY,
      });
    }
  }
  return out;
})();

function projectPin(lat: number, lng: number) {
  return {
    x: lngToPx(lng, ZOOM) - ORIGIN_WX,
    y: latToPx(lat, ZOOM) - ORIGIN_WY,
  };
}

// Pre-project all pins for trail path.
const PIN_POSITIONS = SPOTS.map((s) => projectPin(s.lat, s.lng));

// Curved expedition trail through the pins. Needs ≥3 pins to draw a
// quadratic-then-cubic curve; with fewer we skip the trail.
const TRAIL_D: string | null = (() => {
  if (PIN_POSITIONS.length < 3) return null;
  const [a, b, c] = PIN_POSITIONS;
  const ctrl1x = (a.x + b.x) / 2;
  const ctrl1y = (a.y + b.y) / 2 - 30;
  return `M ${a.x} ${a.y} Q ${ctrl1x} ${ctrl1y} ${b.x} ${b.y} T ${c.x} ${c.y}`;
})();

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

export function FieldMap() {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div>
      <div
        className="relative bg-[var(--color-paper-hi)] paper-fold"
        style={{
          boxShadow:
            "0 2px 0 rgba(28,24,20,0.06), 0 16px 48px rgba(28,24,20,0.20), 0 2px 8px rgba(28,24,20,0.08)",
        }}
      >
        {/* tape strips */}
        <span
          className="tape"
          style={{ top: -14, left: 40, width: 130, height: 26, transform: "rotate(-3deg)" }}
          aria-hidden
        />
        <span
          className="tape"
          style={{ top: -10, right: 60, width: 90, height: 22, transform: "rotate(2.5deg)" }}
          aria-hidden
        />

        <div
          className="relative overflow-hidden"
          style={{ aspectRatio: `${VIEWPORT_W} / ${VIEWPORT_H}` }}
        >
          {/* ── Real-world map tiles (CartoDB Positron, free with attribution) ── */}
          <div
            className="absolute inset-0"
            style={{
              filter: "sepia(0.55) saturate(0.7) contrast(1.06) brightness(1.04)",
            }}
          >
            {TILES.map((t) => {
              const sub = "abcd"[(t.x + t.y) % 4];
              return (
                <img
                  key={`${t.x}-${t.y}`}
                  src={`https://${sub}.basemaps.cartocdn.com/light_all/${ZOOM}/${t.x}/${t.y}@2x.png`}
                  alt=""
                  loading="lazy"
                  style={{
                    position: "absolute",
                    left: pct(t.px, VIEWPORT_W),
                    top: pct(t.py, VIEWPORT_H),
                    width: pct(256, VIEWPORT_W),
                    height: pct(256, VIEWPORT_H),
                    display: "block",
                  }}
                  aria-hidden
                />
              );
            })}
          </div>

          {/* Paper-tone vignette to bind tiles to the field-guide aesthetic */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(236, 227, 210, 0.45), rgba(236, 227, 210, 0)), radial-gradient(ellipse 80% 60% at 70% 90%, rgba(28, 24, 20, 0.20), rgba(28, 24, 20, 0))",
              mixBlendMode: "multiply",
            }}
          />

          {/* Grain texture */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(rgba(28, 24, 20, 0.06) 1px, transparent 1px)",
              backgroundSize: "3px 3px",
              opacity: 0.55,
              mixBlendMode: "multiply",
            }}
          />

          {/* SVG overlay: expedition trail, compass rose, scale bar */}
          <svg
            viewBox={`0 0 ${VIEWPORT_W} ${VIEWPORT_H}`}
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="none"
          >
            {/* Expedition trail (only when 3+ pins) */}
            {TRAIL_D ? (
              <path
                d={TRAIL_D}
                stroke="var(--color-stamp)"
                strokeWidth="1.6"
                fill="none"
                strokeDasharray="3 5"
                strokeLinecap="round"
                className="trail-fade"
                opacity="0"
              />
            ) : null}

            {/* Compass rose (top-right) */}
            <g transform="translate(720, 70)" className="compass-spin">
              <circle r="22" fill="var(--color-paper-hi)" opacity="0.85" />
              <circle r="22" fill="none" stroke="var(--color-ink-mute)" strokeWidth="0.8" />
              <circle r="2.5" fill="var(--color-stamp)" />
              <line x1="0" y1="-22" x2="0" y2="-32" stroke="var(--color-stamp)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="0" y1="22" x2="0" y2="30" stroke="var(--color-ink-mute)" strokeWidth="0.8" />
              <line x1="-22" y1="0" x2="-30" y2="0" stroke="var(--color-ink-mute)" strokeWidth="0.8" />
              <line x1="22" y1="0" x2="30" y2="0" stroke="var(--color-ink-mute)" strokeWidth="0.8" />
              <text y="-38" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="10" fill="var(--color-stamp)" fontWeight="bold">N</text>
            </g>

            {/* Scale bar */}
            <g transform="translate(40, 460)">
              <rect x="-6" y="-12" width="100" height="20" fill="var(--color-paper-hi)" opacity="0.85" />
              <line x1="0" y1="0" x2="60" y2="0" stroke="var(--color-ink)" strokeWidth="1.4" />
              <line x1="0" y1="-3" x2="0" y2="3" stroke="var(--color-ink)" strokeWidth="1.4" />
              <line x1="60" y1="-3" x2="60" y2="3" stroke="var(--color-ink)" strokeWidth="1.4" />
              <text x="30" y="-5" textAnchor="middle" fontFamily="JetBrains Mono" fontSize="8" fill="var(--color-ink-mute)">600 m</text>
            </g>
          </svg>

          {/* Title block (top-left) */}
          <div
            className="absolute top-4 left-4 z-10 pointer-events-none px-2 py-1.5"
            style={{ background: "rgba(236, 227, 210, 0.85)" }}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)]">
              central singapore
            </p>
            <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-faint)] mt-0.5">
              field edition · 001
            </p>
          </div>

          {/* "VIBERED" rubber stamp (bottom-right, above attribution) */}
          <div
            className="absolute bottom-7 right-5 z-10 pointer-events-none"
            style={{
              border: "2px solid var(--color-stamp)",
              color: "var(--color-stamp)",
              transform: "rotate(-6deg)",
              padding: "5px 11px",
              opacity: 0.92,
              background: "rgba(236, 227, 210, 0.85)",
            }}
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] font-bold leading-none">
              vibered · {SPOTS.length}
            </p>
          </div>

          {/* Pin overlay */}
          {SPOTS.map((spot, i) => {
            const pos = projectPin(spot.lat, spot.lng);
            return (
              <Link
                key={spot.id}
                href={`/v/${spot.id}`}
                className="absolute pin-drop"
                style={{
                  left: pct(pos.x, VIEWPORT_W),
                  top: pct(pos.y, VIEWPORT_H),
                  ["--pin-delay" as string]: `${600 + i * 240}ms`,
                  zIndex: 20,
                }}
                onMouseEnter={() => setHovered(spot.id)}
                onMouseLeave={() => setHovered(null)}
                aria-label={`open ${spot.name}, ${spot.area}`}
              >
                {/* number */}
                <span
                  className="absolute font-mono font-bold text-[10px] tracking-[0.16em] text-[var(--color-stamp)]"
                  style={{
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%) translateY(-8px)",
                    whiteSpace: "nowrap",
                    background: "rgba(236, 227, 210, 0.9)",
                    padding: "1px 4px",
                  }}
                >
                  {spot.num}
                </span>

                {/* crosshair */}
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 26,
                    height: 1,
                    background: "var(--color-stamp)",
                    transform: "translate(-50%, -50%)",
                    opacity: 0.5,
                  }}
                />
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: 1,
                    height: 26,
                    background: "var(--color-stamp)",
                    transform: "translate(-50%, -50%)",
                    opacity: 0.5,
                  }}
                />

                {/* pulse ring */}
                <span className="pin-pulse" aria-hidden />

                {/* dot */}
                <span
                  className="pin-dot"
                  style={{
                    position: "relative",
                    display: "block",
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: "var(--color-stamp)",
                    border: "2px solid var(--color-paper-hi)",
                    boxShadow: "0 2px 6px rgba(168,46,26,0.55)",
                  }}
                />

                {/* tooltip */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    top: "calc(100% + 14px)",
                    left: "50%",
                    width: 180,
                    transform: `translateX(-50%) translateY(${
                      hovered === spot.id ? "0" : "6px"
                    }) rotate(${spot.rotate})`,
                    opacity: hovered === spot.id ? 1 : 0,
                    transition:
                      "opacity 220ms ease, transform 320ms cubic-bezier(.16,1,.3,1)",
                    zIndex: 30,
                  }}
                >
                  <div
                    className="bg-[var(--color-paper-hi)] p-2"
                    style={{
                      boxShadow:
                        "0 8px 24px rgba(28,24,20,0.28), 0 1px 0 rgba(28,24,20,0.08)",
                    }}
                  >
                    <div
                      style={{
                        width: "100%",
                        height: 106,
                        backgroundImage: `url(${spot.thumb})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        filter: "saturate(0.88) contrast(1.04)",
                      }}
                    />
                    <p className="display-italic text-[16px] mt-2 leading-tight">
                      {spot.name}
                    </p>
                    <p className="font-mono text-[8px] uppercase tracking-[0.22em] text-[var(--color-ink-faint)] mt-1">
                      {spot.area} · open →
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Attribution (legally required for OSM/CartoDB tiles) */}
          <p
            className="absolute bottom-1 right-2 font-mono text-[7px] tracking-[0.05em] text-[var(--color-ink-mute)] pointer-events-none z-10"
            style={{ background: "rgba(236, 227, 210, 0.7)", padding: "1px 3px" }}
          >
            © OpenStreetMap · CartoDB
          </p>
        </div>
      </div>

      {/* Index list below the map */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
        {SPOTS.map((spot) => (
          <Link
            key={spot.id}
            href={`/v/${spot.id}`}
            className="group flex gap-4 items-start hover:-translate-y-0.5 transition-transform"
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[var(--color-stamp)] font-bold shrink-0 mt-1.5 tabular-nums">
              {spot.num}
            </span>
            <span className="block flex-1 min-w-0">
              <span className="display-italic text-[20px] text-[var(--color-ink)] block leading-tight link-underline">
                {spot.name}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--color-ink-faint)] block mt-1">
                {spot.area}
              </span>
              <span className="text-[12px] text-[var(--color-ink-soft)] block mt-2 leading-snug">
                {spot.vibe}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
