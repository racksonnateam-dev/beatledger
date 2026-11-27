import { PageHeader } from "@/components/shell/page-header";
import { Scanner } from "@/components/scanner/scanner";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeRecognition } from "@/lib/serializers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const rows = await prisma.recognition.findMany({
    where: { ownerId: user.id },
    include: { matchedBeat: { select: { id: true, title: true, producerName: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const beatIds = rows.flatMap((row) => (row.matchedBeatId ? [row.matchedBeatId] : []));
  const licenses = beatIds.length
    ? await prisma.license.findMany({
        where: { ownerId: user.id, beatId: { in: beatIds } },
        include: { customer: { select: { name: true } } },
      })
    : [];
  const history = rows.map((row) =>
    serializeRecognition(
      row,
      licenses
        .filter((license) => license.beatId === row.matchedBeatId)
        .map((license) => ({
          id: license.id,
          paymentStatus: license.paymentStatus,
          expirationDate: license.expirationDate,
          customerName: license.customer.name,
          licenseType: license.licenseType,
          amount: Number(license.amount),
          currency: license.currency,
        })),
    ),
  );
  return (
    <div>
      <PageHeader
        eyebrow="Scanner"
        title="Recognition Scanner"
        description="Drop in a file you already have. BeatLedger asks AudD to name a known recording and return Spotify or Apple Music links, then compares the same file with your private catalogue. It does not search those platforms on its own."
      />
      <Scanner history={history} />
    </div>
  );
}
