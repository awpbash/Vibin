import { notFound } from "next/navigation";
import { getVibe } from "@/lib/vibe-store";
import { Player } from "@/components/Player";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vibe = await getVibe(id);
  if (!vibe) return notFound();

  return (
    <Player
      vibe={vibe}
      previewUrl={vibe.generatedAssets?.previewVideoUrl}
      musicUrl={vibe.generatedAssets?.musicUrl}
    />
  );
}
