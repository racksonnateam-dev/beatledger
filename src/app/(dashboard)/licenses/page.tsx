import { LicenseManager } from "@/components/licenses/license-manager";
import { PageHeader } from "@/components/shell/page-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeLicense } from "@/lib/serializers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LicensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [licenses, beats, customers] = await Promise.all([
    prisma.license.findMany({
      where: { ownerId: user.id },
      include: { beat: { select: { id: true, title: true } }, customer: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.beat.findMany({ where: { ownerId: user.id }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.customer.findMany({ where: { ownerId: user.id }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="Licenses"
        title="Licenses"
        description="Track who bought which beat and whether you have marked the payment paid, unpaid, pending, or refunded."
      />
      <LicenseManager
        licenses={licenses.map(serializeLicense)}
        beats={beats.map((beat) => ({ id: beat.id, label: beat.title }))}
        customers={customers.map((customer) => ({ id: customer.id, label: customer.name }))}
      />
    </div>
  );
}
