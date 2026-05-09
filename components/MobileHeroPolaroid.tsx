"use client";

import { useEffect, useState } from "react";
import { Polaroid } from "./Polaroid";

type HeroItem = {
  src: string;
  alt: string;
  caption: string;
  num: string;
  rotate: string;
  width: number;
  tape?: "tlr" | "top" | "tl" | "tr" | "none";
};

// Three deck positions: front (active), mid, back
const DECK = [
  { scale: 1,    x: 0,   y: 0,  opacity: 1,    zIndex: 3 }, // front — full size, centred
  { scale: 0.90, x: 28,  y: 24, opacity: 0.62, zIndex: 2 }, // mid — slightly right, behind
  { scale: 0.82, x: -18, y: 44, opacity: 0.32, zIndex: 1 }, // back — left, furthest behind
];

export function MobileHeroPolaroid({ items }: { items: HeroItem[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setActive((a) => (a + 1) % items.length), 3500);
    return () => clearInterval(iv);
  }, [items.length]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: 400, paddingTop: 16 }} // paddingTop leaves room for tape strips above cards
    >
      {items.map((item, i) => {
        const pos = DECK[(i - active + items.length) % items.length];
        return (
          <div
            key={i}
            className="absolute left-1/2"
            style={{
              // Compose: centre, deck x-offset, deck y-offset, polaroid tilt, deck scale
              transform: `translateX(calc(-50% + ${pos.x}px)) translateY(${pos.y}px) rotate(${item.rotate}) scale(${pos.scale})`,
              opacity: pos.opacity,
              zIndex: pos.zIndex,
              transition: "transform 800ms cubic-bezier(.2,.8,.2,1), opacity 700ms ease",
              willChange: "transform, opacity",
            }}
          >
            <Polaroid
              src={item.src}
              alt={item.alt}
              caption={item.caption}
              num={item.num}
              width={item.width}
              tape={item.tape}
              priority={i === 0}
            />
          </div>
        );
      })}

      {/* Dot indicators — front card highlighted */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {items.map((_, i) => (
          <span
            key={i}
            style={{
              display: "block",
              width: i === active ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i === active ? "var(--color-stamp)" : "var(--color-rule-soft)",
              transition: "width 400ms ease, background 400ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
