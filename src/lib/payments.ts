import { prisma } from "@/lib/db";

export async function syncLicenseStatus(licenseId: string, ownerId: string) {
  const latest = await prisma.payment.findFirst({
    where: { licenseId, ownerId },
    orderBy: { updatedAt: "desc" },
  });
  if (!latest) return;
  await prisma.license.updateMany({
    where: { id: licenseId, ownerId },
    data: {
      paymentStatus: latest.status,
      paymentDate: latest.status === "PAID" ? latest.updatedAt : null,
    },
  });
}
