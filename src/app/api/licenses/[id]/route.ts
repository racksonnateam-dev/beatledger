import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { syncLicenseStatus } from "@/lib/payments";
import { serializeLicense } from "@/lib/serializers";
import { licenseUpdateSchema, parseOptionalDate } from "@/lib/validation";

const include = { beat: { select: { id: true, title: true } }, customer: { select: { id: true, name: true, email: true } } } as const;

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await prisma.license.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return jsonError(404, "License not found.");
  const parsed = licenseUpdateSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const data = parsed.data;
  if (data.beatId) {
    const beat = await prisma.beat.findFirst({ where: { id: data.beatId, ownerId: user.id }, select: { id: true } });
    if (!beat) return jsonError(400, "Beat not found.");
  }
  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, ownerId: user.id },
      select: { id: true },
    });
    if (!customer) return jsonError(400, "Customer not found.");
  }
  const paymentDate = data.paymentDate !== undefined ? parseOptionalDate(data.paymentDate, "Payment date") : null;
  const expirationDate = data.expirationDate !== undefined ? parseOptionalDate(data.expirationDate, "Expiration date") : null;
  if (paymentDate && !paymentDate.ok) return jsonError(400, paymentDate.error);
  if (expirationDate && !expirationDate.ok) return jsonError(400, expirationDate.error);

  await prisma.license.update({
    where: { id: existing.id },
    data: {
      beatId: data.beatId,
      customerId: data.customerId,
      licenseType: data.licenseType,
      amount: data.amount,
      currency: data.currency,
      paymentStatus: data.paymentStatus,
      notes: data.notes === undefined ? undefined : data.notes,
      paymentDate: paymentDate?.ok ? paymentDate.date : undefined,
      expirationDate: expirationDate?.ok ? expirationDate.date : undefined,
    },
  });
  if (data.paymentStatus) {
    const latest = await prisma.payment.findFirst({
      where: { licenseId: existing.id, ownerId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    if (latest) {
      await prisma.payment.update({ where: { id: latest.id }, data: { status: data.paymentStatus } });
      await syncLicenseStatus(existing.id, user.id);
    }
  }
  const license = await prisma.license.findFirst({ where: { id: existing.id, ownerId: user.id }, include });
  return NextResponse.json({ license: serializeLicense(license!) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await prisma.license.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!existing) return jsonError(404, "License not found.");
  await prisma.license.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
