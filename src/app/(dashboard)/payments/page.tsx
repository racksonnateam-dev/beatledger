import { PaymentManager } from "@/components/payments/payment-manager";
import { PageHeader } from "@/components/shell/page-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { serializePayment } from "@/lib/serializers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const [payments, licenses, paid, outstanding] = await Promise.all([
    prisma.payment.findMany({
      where: { ownerId: user.id },
      include: { license: { include: { beat: { select: { title: true } }, customer: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.license.findMany({
      where: { ownerId: user.id },
      include: { beat: { select: { title: true } }, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.aggregate({ where: { ownerId: user.id, status: "PAID" }, _sum: { amount: true } }),
    prisma.payment.aggregate({
      where: { ownerId: user.id, status: { in: ["UNPAID", "PENDING"] } },
      _sum: { amount: true },
    }),
  ]);
  return (
    <div>
      <PageHeader
        eyebrow="Ledger"
        title="Payments"
        description="Record what was paid, what is still open, and the reference you want to keep. Editing a payment updates the license status."
      />
      <PaymentManager
        payments={payments.map(serializePayment)}
        licenses={licenses.map((license) => ({
          id: license.id,
          label: `${license.beat.title} · ${license.customer.name}`,
        }))}
        revenue={formatMoney(Number(paid._sum.amount ?? 0))}
        outstanding={formatMoney(Number(outstanding._sum.amount ?? 0))}
      />
    </div>
  );
}
