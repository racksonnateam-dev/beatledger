import { BeatBrowser } from "@/components/beats/beat-browser";
import { BeatUpload } from "@/components/beats/beat-upload";
import { PageHeader } from "@/components/shell/page-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeBeat } from "@/lib/serializers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function BeatsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const beats = await prisma.beat.findMany({
    where: { ownerId: user.id },
    include: { fingerprint: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Catalogue"
        title="My Beats"
        description="Upload a beat, preview it, and keep the fingerprint status next to the file. Audio is served only to your signed-in session."
      />
      <BeatUpload producerName={user.name || "Producer"} />
      <BeatBrowser beats={beats.map(serializeBeat)} />
    </div>
  );
}
