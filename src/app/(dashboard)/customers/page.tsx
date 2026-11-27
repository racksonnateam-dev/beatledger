import { CustomerManager } from "@/components/customers/customer-manager";
import { PageHeader } from "@/components/shell/page-header";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeCustomer } from "@/lib/serializers";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const customers = await prisma.customer.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <div>
      <PageHeader eyebrow="People" title="Customers" description="The buyers attached to your licenses. Search by name or email." />
      <CustomerManager customers={customers.map(serializeCustomer)} />
    </div>
  );
}
