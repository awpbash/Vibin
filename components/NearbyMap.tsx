"use client";

// Interactive Google Maps embed in the magazine's editorial paper
// aesthetic. Real Google Maps JS API — judges can pan, zoom, click
// pins. The paper texture comes from a multiply-blended overlay on
// top of a muted-saturation custom map style.
//
// Falls back to the previous SVG paper map when no public API key is
// configured, so dev still works offline.

import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  useAdvancedMarkerRef,
} from "@vis.gl/react-google-maps";
import { useState } from "react";
import type { Place } from "@/lib/types";

const VENUE = {
  lat: parseFloat(process.env.NEXT_PUBLIC_VIBER_VENUE_LAT ?? "1.3018"),
  lng: parseFloat(process.env.NEXT_PUBLIC_VIBER_VENUE_LNG ?? "103.8553"),
};
const ZOOM = 14;

// Muted, low-saturation map style. Tuned to sit underneath the paper
// overlay so it reads as a printed map, not a Google Maps default.
const PAPER_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  {
    featureType: "landscape.man_made",
    stylers: [{ color: "#ece3d2" }],
  },
  {
    featureType: "landscape.natural",
    stylers: [{ color: "#d9cdb1" }],
  },
  {
    featureType: "landscape.natural.terrain",
    stylers: [{ color: "#c7b893" }],
  },
  { featureType: "water", stylers: [{ color: "#6f6557" }] },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#b9ad95" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#a89a7e" }],
  },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#8a7c63" }],
  },
  {
    featureType: "administrative",
    elementType: "labels",
    stylers: [{ visibility: "off" }],
  },
];

export function NearbyMap({ places }: { places: Place[] }) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <figure className="relative">
      <div
        className="relative"
        style={{
          aspectRatio: "920 / 580",
          background: "var(--color-paper-hi)",
          boxShadow: "var(--shadow-paper)",
          padding: 18,
        }}
      >
        <div
          className="relative w-full h-full overflow-hidden"
          style={{ background: "var(--color-paper)" }}
        >
          {key ? (
            <APIProvider apiKey={key}>
              <Map
                defaultCenter={VENUE}
                defaultZoom={ZOOM}
                gestureHandling="cooperative"
                disableDefaultUI={true}
                clickableIcons={false}
                styles={PAPER_MAP_STYLE}
                style={{ width: "100%", height: "100%" }}
              >
                <VenueMarker />
                {places.map((p, i) => (
                  <NumberedPlaceMarker key={p.id} place={p} index={i} />
                ))}
              </Map>
            </APIProvider>
          ) : (
            <PaperFallback />
          )}

          {places.length === 0 ? <EmptyPlaces hasKey={Boolean(key)} /> : null}

          {/* Paper-multiply overlay so even the live tiles read printed. */}
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
        </div>
      </div>

      <figcaption className="mt-3 px-1 flex items-baseline justify-between caption">
        <span>fig. 01 / within 2 km of the field unit</span>
        <span className="tabular-nums">{places.length} matches</span>
      </figcaption>
    </figure>
  );
}

// ---------- markers ----------

function VenueMarker() {
  return (
    <AdvancedMarker position={VENUE}>
      <div
        className="block w-3 h-3 rounded-full"
        style={{
          background: "var(--color-ink)",
          boxShadow: "0 0 0 1.5px var(--color-paper)",
        }}
        title="you are here"
      />
    </AdvancedMarker>
  );
}

function NumberedPlaceMarker({
  place,
  index,
}: {
  place: Place;
  index: number;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={place.location}
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex flex-col items-center pointer-events-auto cursor-pointer">
          <div
            className="relative flex items-center justify-center transition-transform hover:scale-110"
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "var(--color-paper-hi)",
              border: "1.5px solid var(--color-rule)",
              boxShadow: "0 2px 10px rgba(28,24,20,0.25)",
            }}
          >
            <span className="display-italic text-[20px] leading-none text-[var(--color-ink)]">
              {index + 1}
            </span>
          </div>
          <span
            className="block w-px"
            style={{ height: 10, background: "var(--color-rule)" }}
          />
          <span
            className="caption mt-1 whitespace-nowrap px-1.5 py-0.5"
            style={{ background: "var(--color-paper-hi)" }}
          >
            {place.name.toLowerCase()}
          </span>
        </div>
      </AdvancedMarker>

      {open && marker ? (
        <InfoWindow anchor={marker} onClose={() => setOpen(false)}>
          <div className="font-[var(--font-sans)] min-w-[220px] max-w-[260px] text-[13px]">
            <p className="display-md text-[16px] leading-tight text-[var(--color-ink)] mb-1">
              {place.name}
            </p>
            <p className="caption mb-2">
              {place.neighbourhood}
              {place.distanceMeters
                ? ` · ${Math.round(place.distanceMeters)}m`
                : ""}
              {place.walkMinutes ? ` · ${place.walkMinutes} min walk` : ""}
            </p>
            {place.rating ? (
              <p className="caption mb-2">
                <span className="font-mono tabular-nums text-[var(--color-ink)]">
                  ★ {place.rating.toFixed(1)}
                </span>
              </p>
            ) : null}
            {place.whyThisMatches ? (
              <p
                className="display-italic text-[13px] leading-snug text-[var(--color-ink-soft)]"
                style={{ maxWidth: "240px" }}
              >
                {place.whyThisMatches}
              </p>
            ) : null}
            {place.googlePlaceId ? (
              <a
                href={`https://www.google.com/maps/place/?q=place_id:${place.googlePlaceId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="caption link-underline mt-2 block"
              >
                open in google maps ↗
              </a>
            ) : null}
          </div>
        </InfoWindow>
      ) : null}
    </>
  );
}

// ---------- empty-state overlay ----------

// Rendered on top of the map (paper-styled or live) when we have zero
// places to plot. Editorial placeholder, not a crash, not a blank.
function EmptyPlaces({ hasKey }: { hasKey: boolean }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="px-6 py-4 text-center"
        style={{
          background: "var(--color-paper-hi)",
          border: "1px solid var(--color-rule)",
          boxShadow: "0 2px 14px rgba(28,24,20,0.12)",
          maxWidth: "60%",
        }}
      >
        <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-[var(--color-ink-mute)] mb-2">
          field unit · no signal
        </p>
        <p className="display-italic text-[18px] leading-snug text-[var(--color-ink)]">
          no nearby places loaded.
        </p>
        <p className="caption mt-2 text-[var(--color-ink-soft)]">
          {hasKey
            ? "the places index is dark — try again in a moment."
            : "add a maps key to plot real cafes here."}
        </p>
      </div>
    </div>
  );
}

// ---------- fallback when no key ----------

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
      <span className="absolute bottom-3 right-3 caption">
        map preview · add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for live data
      </span>
    </div>
  );
}
