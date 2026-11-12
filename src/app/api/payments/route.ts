import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { syncLicenseStatus } from "@/lib/payments";
import { serializePayment } from "@/lib/serializers";
import { paymentSchema } from "@/lib/validation";

const include = {
  license: { include: { beat: { select: { title: true } }, customer: { select: { name: true } } } },
} as const;

export async function GET() {
  const { user, error } = await requireUser();
  if (!user) return error;
  const payments = await prisma.payment.findMany({
    where: { ownerId: user.id },
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ payments: payments.map(serializePayment) });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const parsed = paymentSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const license = await prisma.license.findFirst({
    where: { id: parsed.data.licenseId, ownerId: user.id },
    select: { id: true },
  });
  if (!license) return jsonError(400, "Choose a license from your account.");
  const payment = await prisma.payment.create({
    data: {
      ownerId: user.id,
      licenseId: license.id,
      amount: parsed.data.amount,
      currency: parsed.data.currency,
      paymentMethod: parsed.data.paymentMethod ?? null,
      transactionReference: parsed.data.transactionReference ?? null,
      status: parsed.data.status,
    },
    include,
  });
  await syncLicenseStatus(license.id, user.id);
  const refreshed = await prisma.payment.findFirst({ where: { id: payment.id, ownerId: user.id }, include });
  return NextResponse.json({ payment: serializePayment(refreshed!) }, { status: 201 });
}
