"use client";

import { useEffect } from "react";
import { applyVibePalette, resetVibePalette } from "@/lib/colors";

export function ApplyPalette({
  hexes,
  accent,
}: {
  hexes: string[];
  accent?: string;
}) {
  useEffect(() => {
    applyVibePalette(hexes, accent);
    return () => resetVibePalette();
  }, [hexes, accent]);
  return null;
}
