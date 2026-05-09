import Image from "next/image";
import type { Place } from "@/lib/types";

const VENUE = {
  lat: parseFloat(process.env.NEXT_PUBLIC_VIBER_VENUE_LAT ?? "1.3018"),
  lng: parseFloat(process.env.NEXT_PUBLIC_VIBER_VENUE_LNG ?? "103.8553"),
};
const ZOOM = 14;
const W = 920;
const H = 580;

const PAPER_STYLE = [
  // Hide all labels and noise.
  "feature:all|element:labels|visibility:off",
  "feature:transit|visibility:off",
  "feature:poi|visibility:off",
  // Paper landscape.
  "feature:landscape.man_made|color:0xece3d2",
  "feature:landscape.natural|color:0xd9cdb1",
  "feature:landscape.natural.terrain|color:0xc7b893",
  // Water like ink.
  "feature:water|color:0x6f6557",
  // Roads as warm ink.
  "feature:road|element:geometry|color:0xb9ad95",
  "feature:road.highway|element:geometry|color:0xa89a7e",
  "feature:road|element:labels|visibility:off",
  // Administrative borders subtle.
  "feature:administrative|element:geometry|color:0x8a7c63",
  "feature:administrative|element:labels|visibility:off",
];

export function NearbyMap({ places }: { places: Place[] }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasKey = Boolean(key);

  const mapUrl = hasKey
    ? buildStaticMapUrl(VENUE, ZOOM, W, H, key as string)
    : null;

  return (
    <figure className="relative">
      <div
        className="relative"
        style={{
          aspectRatio: `${W} / ${H}`,
          background: "var(--color-paper-hi)",
          boxShadow: "var(--shadow-paper)",
          padding: 18,
          transform: "rotate(-0.4deg)",
        }}
      >
        <span
          className="tape"
          style={{
            top: -12,
            left: 28,
            width: 110,
            height: 22,
            transform: "rotate(-4deg)",
          }}
          aria-hidden
        />
        <span
          className="tape"
          style={{
            top: -10,
            right: 36,
            width: 86,
            height: 20,
            transform: "rotate(6deg)",
          }}
          aria-hidden
        />

        <div
          className="relative w-full h-full overflow-hidden"
          style={{ background: "var(--color-paper)" }}
        >
          {mapUrl ? (
            <Image
              src={mapUrl}
              alt="map of nearby places"
              fill
              className="object-cover"
              style={{ filter: "contrast(1.05) saturate(0.85)" }}
              unoptimized
            />
          ) : (
            <PaperFallback />
          )}

          {/* Multiply overlay to make even bright maps feel like paper. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(236, 227, 210, 0.4), rgba(236, 227, 210, 0)), radial-gradient(ellipse 80% 60% at 70% 90%, rgba(28, 24, 20, 0.18), rgba(28, 24, 20, 0))",
              mixBlendMode: "multiply",
            }}
          />

          {/* Grain over the map. */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(rgba(28, 24, 20, 0.06) 1px, transparent 1px)",
              backgroundSize: "3px 3px",
              opacity: 0.7,
              mixBlendMode: "multiply",
            }}
          />

          {/* Radius circle, pencil red */}
          <Radius />

          {/* Venue pin */}
          <VenuePin />

          {/* Place pins, projected from lat/lng */}
          {places.map((p, i) => {
            const { x, y } = project(p.location, VENUE, ZOOM, W, H);
            return (
              <PlacePin key={p.id} x={x} y={y} index={i} name={p.name} />
            );
          })}
        </div>
      </div>

      <figcaption className="mt-3 px-1 flex items-baseline justify-between caption">
        <span>fig. 01 / within 2 km of the field unit</span>
        <span className="tabular-nums">{places.length} matches</span>
      </figcaption>
    </figure>
  );
}

// ---------- pieces ----------

function VenuePin() {
  const { x, y } = project(VENUE, VENUE, ZOOM, W, H);
  return (
    <div
      className="absolute"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
    >
      <span className="block w-3 h-3 rounded-full bg-[var(--color-ink)] ring-1 ring-[var(--color-paper)]" />
      <span className="absolute left-5 top-[-6px] caption whitespace-nowrap">
        you are here
      </span>
    </div>
  );
}

function PlacePin({
  x,
  y,
  index,
  name,
}: {
  x: number;
  y: number;
  index: number;
  name: string;
}) {
  return (
    <div
      className="absolute drop-pin"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        animationDelay: `${300 + index * 220}ms`,
      }}
    >
      <div className="relative flex flex-col items-center">
        <div
          className="relative flex items-center justify-center"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: "var(--color-paper-hi)",
            border: "1.5px solid var(--color-rule)",
            boxShadow: "0 2px 10px rgba(28,24,20,0.25)",
          }}
        >
          <span
            className="display-italic text-[20px] leading-none text-[var(--color-ink)]"
          >
            {index + 1}
          </span>
        </div>
        <span
          className="block w-px"
          style={{
            height: 12,
            background: "var(--color-rule)",
          }}
        />
        <span className="caption mt-1 whitespace-nowrap bg-[var(--color-paper-hi)] px-1.5 py-0.5">
          {name.toLowerCase()}
        </span>
      </div>
    </div>
  );
}

function Radius() {
  const { x, y } = project(VENUE, VENUE, ZOOM, W, H);
  // 2km radius in pixels at this zoom: pixelsPerMeter * 2000
  const ppm = pixelsPerMeter(VENUE.lat, ZOOM);
  const r = ppm * 2000;
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden
    >
      <circle
        cx={x}
        cy={y}
        r={r}
        fill="none"
        stroke="rgba(168, 46, 26, 0.55)"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
    </svg>
  );
}

function PaperFallback() {
  return (
    <div className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, var(--color-paper-hi), var(--color-paper))",
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <pattern
            id="topo"
            width="80"
            height="80"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 60 Q 20 50 40 56 T 80 60"
              fill="none"
              stroke="rgba(28,24,20,0.06)"
              strokeWidth="0.6"
            />
            <path
              d="M 0 30 Q 20 22 40 28 T 80 32"
              fill="none"
              stroke="rgba(28,24,20,0.04)"
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#topo)" />
        {/* Coastline strokes */}
        <path
          d={`M 0 ${H * 0.85} C ${W * 0.15} ${H * 0.83}, ${W * 0.4} ${H * 0.88}, ${W * 0.6} ${H * 0.84} S ${W} ${H * 0.86}, ${W} ${H * 0.85}`}
          fill="none"
          stroke="rgba(28,24,20,0.5)"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        <path
          d={`M ${W * 0.45} 0 C ${W * 0.5} ${H * 0.2}, ${W * 0.55} ${H * 0.4}, ${W * 0.5} ${H * 0.6}`}
          fill="none"
          stroke="rgba(28,24,20,0.18)"
          strokeWidth="0.9"
        />
      </svg>
      <span className="absolute bottom-3 right-3 caption">
        map preview · add a maps key for live data
      </span>
    </div>
  );
}

// ---------- Mercator projection ----------

function buildStaticMapUrl(
  center: { lat: number; lng: number },
  zoom: number,
  w: number,
  h: number,
  key: string,
): string {
  const params = new URLSearchParams({
    center: `${center.lat},${center.lng}`,
    zoom: String(zoom),
    size: `${Math.min(w, 640)}x${Math.min(h, 640)}`,
    scale: "2",
    maptype: "roadmap",
    key,
  });
  const styles = PAPER_STYLE.map((s) => `&style=${encodeURIComponent(s)}`).join("");
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}${styles}`;
}

function project(
  point: { lat: number; lng: number },
  center: { lat: number; lng: number },
  zoom: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const ppm = pixelsPerMeter(center.lat, zoom);
  const dx =
    haversineSigned(center.lat, center.lng, center.lat, point.lng) * ppm;
  const dy =
    haversineSigned(center.lat, center.lng, point.lat, center.lng) * ppm;
  const sx = point.lng >= center.lng ? 1 : -1;
  const sy = point.lat <= center.lat ? 1 : -1;
  return { x: w / 2 + sx * Math.abs(dx), y: h / 2 + sy * Math.abs(dy) };
}

function pixelsPerMeter(lat: number, zoom: number): number {
  // World pixels per metre at given lat and zoom. Multiplied by the scale=2.
  const earthCircumference = 40075016.686;
  const metresPerPixel =
    (earthCircumference * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom + 8);
  return (1 / metresPerPixel) * 2; // scale=2
}

function haversineSigned(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
) {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
