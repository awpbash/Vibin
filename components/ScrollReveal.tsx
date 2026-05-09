"use client";

import { useCallback, useState, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Stagger children using the .scroll-reveal-stagger primitive */
  stagger?: boolean;
  /** Element tag — defaults to <div>. Use "section" / "aside" etc. as needed. */
  as?: "div" | "section" | "aside" | "ol" | "ul";
  /** Margin offset for IntersectionObserver — fires before fully in view */
  rootMargin?: string;
};

export function ScrollReveal({
  children,
  className = "",
  stagger,
  as: Tag = "div",
  rootMargin = "0px 0px -10% 0px",
}: Props) {
  const [shown, setShown] = useState(false);

  // Callback ref attaches the IntersectionObserver as soon as the element mounts.
  // Avoids the polymorphic-ref TS pain of useRef + dynamic Tag.
  const attach = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      if (typeof IntersectionObserver === "undefined") {
        setShown(true);
        return;
      }
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              setShown(true);
              io.disconnect();
              break;
            }
          }
        },
        { rootMargin, threshold: 0.08 },
      );
      io.observe(el);
    },
    [rootMargin],
  );

  const base = stagger ? "scroll-reveal-stagger" : "scroll-reveal";
  const cls = `${base} ${shown ? "in-view" : ""} ${className}`.trim();

  // Each Tag has a different ref-element type; the callback ref accepts a union
  // of HTMLElement, so cast at the assignment site rather than the storage site.
  return (
    <Tag ref={attach as never} className={cls}>
      {children}
    </Tag>
  );
}
