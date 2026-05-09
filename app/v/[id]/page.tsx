import { notFound } from "next/navigation";
import { getVibe, getPlacesForVibe } from "@/lib/vibe-store";
import { VibeStudio } from "@/components/VibeStudio";

export default async function VibePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vibe = await getVibe(id);
  if (!vibe) return notFound();
  const places = await getPlacesForVibe(id);
  return <VibeStudio vibe={vibe} places={places} />;
}
