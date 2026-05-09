"use client";

import { forwardRef } from "react";

type Props = {
  onClick?: () => void;
  disabled?: boolean;
  primary: string;
  secondary: string;
  serial?: string;
  rotate?: boolean;
  busy?: boolean;
};

export const StampButton = forwardRef<HTMLButtonElement, Props>(function StampButton(
  { onClick, disabled, primary, secondary, serial = "no. 001 / sg", rotate = true, busy },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy}
      className={`stamp ${rotate ? "stamp-rotate" : ""} disabled:opacity-50 ${busy ? "stamp-busy" : ""}`}
    >
      <span className="stamp-ink" aria-hidden />

      {/* Curved serial along the top */}
      <svg
        width="264"
        height="264"
        viewBox="0 0 264 264"
        className="absolute inset-0 pointer-events-none"
        aria-hidden
      >
        <defs>
          <path
            id="stamp-arc-top"
            d="M 32,132 A 100,100 0 0,1 232,132"
          />
          <path
            id="stamp-arc-bottom"
            d="M 32,132 A 100,100 0 0,0 232,132"
          />
        </defs>
        <text
          fill="currentColor"
          fontFamily="var(--font-mono)"
          fontSize="11"
          letterSpacing="3"
          opacity="0.85"
        >
          <textPath href="#stamp-arc-top" startOffset="50%" textAnchor="middle">
            VIBER · FIELD UNIT · SINGAPORE
          </textPath>
        </text>
        <text
          fill="currentColor"
          fontFamily="var(--font-mono)"
          fontSize="10"
          letterSpacing="2.5"
          opacity="0.7"
        >
          <textPath href="#stamp-arc-bottom" startOffset="50%" textAnchor="middle">
            {serial.toUpperCase()}
          </textPath>
        </text>
      </svg>

      {/* Centre */}
      <span className="relative flex flex-col items-center gap-1.5">
        <span
          className="display-italic leading-none"
          style={{ fontSize: 56, color: "currentColor" }}
        >
          {busy ? "..." : primary}
        </span>
        <span
          className="font-mono text-[10px] tracking-[0.22em] uppercase"
          style={{ color: "currentColor", opacity: 0.85 }}
        >
          {secondary}
        </span>
      </span>

      {/* Six small notches around the perimeter for stamp character */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <span
          key={deg}
          aria-hidden
          className="absolute"
          style={{
            width: 6,
            height: 6,
            borderRadius: 6,
            background: "currentColor",
            top: "50%",
            left: "50%",
            opacity: 0.6,
            transform: `rotate(${deg}deg) translateY(-118px) translate(-3px, -3px)`,
          }}
        />
      ))}
    </button>
  );
});
