"use client";

// Last-resort boundary: errors thrown in the root layout itself land
// here. Must include its own <html> and <body> because the layout
// failed before they were emitted.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[viber global error]", error);
  }, [error]);

  return (
    <html>
      <body
        style={{
          margin: 0,
          padding: "60px 24px",
          fontFamily: "system-ui, sans-serif",
          background: "#ece3d2",
          color: "#1c1814",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: "monospace",
              fontSize: 10,
              letterSpacing: "0.24em",
              textTransform: "uppercase",
              color: "#a82e1a",
              marginBottom: 16,
            }}
          >
            press jammed at the root
          </p>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 56,
              lineHeight: 1,
              fontWeight: 500,
              margin: 0,
            }}
          >
            <span>a page,</span>
            <br />
            <span style={{ fontStyle: "italic" }}>misprinted.</span>
          </h1>
          <p style={{ fontSize: 18, marginTop: 24, color: "#5b5450" }}>
            {error.message || "an error occurred at the root layout level."}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 32,
              padding: "10px 18px",
              border: "1px solid #1c1814",
              background: "transparent",
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            try again
          </button>
        </div>
      </body>
    </html>
  );
}
