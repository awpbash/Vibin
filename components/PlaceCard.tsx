import Image from "next/image";
import type { Place } from "@/lib/types";

export function PlaceCard({ place, index }: { place: Place; index: number }) {
  const directionsHref = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
    place.name + " " + place.address,
  )}${place.googlePlaceId ? `&destination_place_id=${place.googlePlaceId}` : ""}`;
  return (
    <article
      className="relative reveal"
      style={{ animationDelay: `${index * 140 + 500}ms` }}
    >
      <a
        href={directionsHref}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-[var(--color-paper-hi)] p-4 transition-shadow hover:shadow-[var(--shadow-paper)]"
        style={{ boxShadow: "var(--shadow-card)" }}
        aria-label={`Open directions to ${place.name}`}
      >
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-5 relative aspect-[4/5] overflow-hidden bg-[var(--color-paper-shadow)]">
            <Image
              src={place.photoUrl}
              alt={place.name}
              fill
              sizes="240px"
              className="object-cover"
            />
            <span className="absolute top-2 left-2 font-mono text-[10px] tabular-nums tracking-[0.18em] text-[var(--color-paper)] bg-[var(--color-ink)] px-1.5 py-0.5">
              {String(index + 1).padStart(2, "0")}
            </span>
          </div>

          <div className="col-span-7 flex flex-col py-1">
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <h3 className="display-md text-[22px] leading-[1.05] text-[var(--color-ink)]">
                {place.name}
              </h3>
              <span className="font-mono text-[10px] tabular-nums tracking-[0.12em] text-[var(--color-stamp)] whitespace-nowrap">
                {(place.matchScore * 100).toFixed(0)}%
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-3 caption">
              <span>{place.neighbourhood.toLowerCase()}</span>
              <span>·</span>
              <span className="tabular-nums">
                {(place.distanceMeters / 1000).toFixed(1)} km
              </span>
              <span>·</span>
              <span className="tabular-nums">{place.walkMinutes} min walk</span>
              {place.openNow ? (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--color-stamp)" }}>open now</span>
                </>
              ) : null}
            </div>

            <p className="display-italic text-[17px] leading-[1.5] text-[var(--color-ink-soft)]">
              {place.whyThisMatches}
            </p>
          </div>
        </div>
      </a>

      <div className="mt-2 flex items-baseline justify-between caption px-1">
        <span>{place.address.toLowerCase()}</span>
        <a
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="link-underline"
        >
          directions ↗
        </a>
      </div>
    </article>
  );
}
