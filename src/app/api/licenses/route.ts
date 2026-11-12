import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { syncLicenseStatus } from "@/lib/payments";
import { serializeLicense } from "@/lib/serializers";
import { licenseSchema, parseOptionalDate } from "@/lib/validation";

const include = { beat: { select: { id: true, title: true } }, customer: { select: { id: true, name: true, email: true } } } as const;

export async function GET(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim();
  const status = params.get("status");
  const licenses = await prisma.license.findMany({
    where: {
      ownerId: user.id,
      ...(status === "PAID" || status === "UNPAID" || status === "PENDING" || status === "REFUNDED"
        ? { paymentStatus: status }
        : {}),
      ...(query
        ? {
            OR: [
              { beat: { title: { contains: query, mode: "insensitive" } } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
              { customer: { email: { contains: query, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ licenses: licenses.map(serializeLicense) });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const parsed = licenseSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const paymentDate = parseOptionalDate(parsed.data.paymentDate, "Payment date");
  const expirationDate = parseOptionalDate(parsed.data.expirationDate, "Expiration date");
  if (!paymentDate.ok) return jsonError(400, paymentDate.error);
  if (!expirationDate.ok) return jsonError(400, expirationDate.error);
  const [beat, customer] = await Promise.all([
    prisma.beat.findFirst({ where: { id: parsed.data.beatId, ownerId: user.id }, select: { id: true } }),
    prisma.customer.findFirst({ where: { id: parsed.data.customerId, ownerId: user.id }, select: { id: true } }),
  ]);
  if (!beat || !customer) return jsonError(400, "Choose a beat and customer from your account.");

  const license = await prisma.$transaction(async (tx) => {
    const created = await tx.license.create({
      data: {
        ownerId: user.id,
        beatId: beat.id,
        customerId: customer.id,
        licenseType: parsed.data.licenseType,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        paymentStatus: parsed.data.paymentStatus,
        paymentDate: parsed.data.paymentStatus === "PAID" ? paymentDate.date ?? new Date() : paymentDate.date,
        expirationDate: expirationDate.date,
        notes: parsed.data.notes,
      },
    });
    await tx.payment.create({
      data: {
        ownerId: user.id,
        licenseId: created.id,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
        paymentMethod: parsed.data.paymentMethod ?? null,
        transactionReference: parsed.data.transactionReference ?? null,
        status: parsed.data.paymentStatus,
      },
    });
    return created;
  });
  await syncLicenseStatus(license.id, user.id);
  const full = await prisma.license.findFirst({ where: { id: license.id, ownerId: user.id }, include });
  return NextResponse.json({ license: serializeLicense(full!) }, { status: 201 });
}
