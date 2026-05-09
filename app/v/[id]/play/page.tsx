import { notFound } from "next/navigation";
import { getVibe } from "@/lib/mock-data";
import { Player } from "@/components/Player";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const vibe = await getVibe(id);
  if (!vibe) return notFound();

  return <Player vibe={vibe} previewUrl={vibe.generatedAssets?.previewVideoUrl} />;
}
