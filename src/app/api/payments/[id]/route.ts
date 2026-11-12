import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { syncLicenseStatus } from "@/lib/payments";
import { serializePayment } from "@/lib/serializers";
import { paymentUpdateSchema } from "@/lib/validation";

const include = {
  license: { include: { beat: { select: { title: true } }, customer: { select: { name: true } } } },
} as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await prisma.payment.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return jsonError(404, "Payment not found.");
  const parsed = paymentUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  await prisma.payment.update({
    where: { id: existing.id },
    data: {
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      paymentMethod: parsed.data.paymentMethod === undefined ? undefined : parsed.data.paymentMethod,
      transactionReference:
        parsed.data.transactionReference === undefined ? undefined : parsed.data.transactionReference,
      status: parsed.data.status,
    },
  });
  await syncLicenseStatus(existing.licenseId, user.id);
  const payment = await prisma.payment.findFirst({ where: { id: existing.id, ownerId: user.id }, include });
  return NextResponse.json({ payment: serializePayment(payment!) });
}
