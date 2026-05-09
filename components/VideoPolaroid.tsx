"use client";

// Same paper-and-tape framing as Polaroid, but the photo well is a
// muted, looping <video>. Used on the results page hero when the vibe
// came from an uploaded clip — so the reader sees their actual upload
// (collapsed, looping) and knows the inference ran on their footage.

type Props = {
  src: string;
  caption?: string;
  num?: string;
  rotate?: string;
  width?: number;
  height?: number;
  tape?: "top" | "tl" | "tr" | "tlr" | "none";
  className?: string;
  poster?: string;
};

export function VideoPolaroid({
  src,
  caption,
  num,
  rotate = "0deg",
  width = 320,
  height = 380,
  tape = "tlr",
  className = "",
  poster,
}: Props) {
  return (
    <div
      className={`polaroid ${className}`}
      style={{ width, transform: `rotate(${rotate})` }}
    >
      {tape === "top" ? (
        <TapeStrip top={-12} left="50%" tx="-50%" rot={-2} w={88} h={20} />
      ) : null}
      {(tape === "tl" || tape === "tlr") ? (
        <TapeStrip top={-10} left={-14} rot={-22} w={70} h={18} />
      ) : null}
      {(tape === "tr" || tape === "tlr") ? (
        <TapeStrip top={-10} right={-12} rot={18} w={70} h={18} />
      ) : null}

      <div
        className="relative overflow-hidden bg-[var(--color-paper-shadow)]"
        style={{ aspectRatio: `${width} / ${height - 70}` }}
      >
        <video
          src={src}
          poster={poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,247,230,0.06), rgba(28,24,20,0.06))",
            mixBlendMode: "multiply",
          }}
        />
        {/* Tiny "REC ↻" badge so it reads as captured-from-life, not a stock loop */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-[var(--color-paper-hi)]/80 backdrop-blur-sm">
          <span
            className="block w-1.5 h-1.5 rounded-full bg-[var(--color-stamp)]"
            style={{ animation: "pulse 2s ease-in-out infinite" }}
          />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[var(--color-ink)]">
            your clip
          </span>
        </div>
      </div>

      {(caption || num) && (
        <div className="polaroid-label">
          <span>{caption}</span>
          {num ? <span className="polaroid-num">{num}</span> : null}
        </div>
      )}
    </div>
  );
}

function TapeStrip({
  top,
  left,
  right,
  tx,
  rot = 0,
  w,
  h,
}: {
  top: number;
  left?: number | string;
  right?: number | string;
  tx?: string;
  rot?: number;
  w: number;
  h: number;
}) {
  return (
    <span
      className="tape"
      style={{
        top,
        left,
        right,
        width: w,
        height: h,
        transform: `${tx ? `translateX(${tx})` : ""} rotate(${rot}deg)`,
      }}
      aria-hidden
    />
  );
}
