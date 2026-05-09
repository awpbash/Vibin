import Image from "next/image";

type Props = {
  src: string;
  alt: string;
  caption?: string;
  num?: string;
  rotate?: string;
  width?: number;
  height?: number;
  tape?: "top" | "tl" | "tr" | "tlr" | "none";
  className?: string;
  priority?: boolean;
  /** Continuous idle motion variant — leave undefined for a static polaroid. */
  float?: "a" | "b" | "c";
};

export function Polaroid({
  src,
  alt,
  caption,
  num,
  rotate = "0deg",
  width = 320,
  height = 380,
  tape = "tlr",
  className = "",
  priority = false,
  float,
}: Props) {
  const floatClass = float ? `float-${float}` : "";
  // When floating, the keyframes consume `--rot`; otherwise we apply rotate directly.
  const style: React.CSSProperties = float
    ? { width, ["--rot" as string]: rotate, transform: `rotate(${rotate})` }
    : { width, transform: `rotate(${rotate})` };

  return (
    <div className={`polaroid ${floatClass} ${className}`} style={style}>
      {tape === "top" ? <TapeStrip top={-12} left="50%" tx="-50%" rot={-2} w={88} h={20} /> : null}
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
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${width}px`}
          className="polaroid-image object-cover"
          priority={priority}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,247,230,0.06), rgba(28,24,20,0.06))",
            mixBlendMode: "multiply",
          }}
        />
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
