import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { serializeCustomer } from "@/lib/serializers";
import { customerSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await prisma.customer.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return jsonError(404, "Customer not found.");
  const parsed = customerSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const customer = await prisma.customer.update({
      where: { id: existing.id },
      data: { name: parsed.data.name, email: parsed.data.email.toLowerCase() },
    });
    return NextResponse.json({ customer: serializeCustomer(customer) });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(409, "You already have a customer with that email.");
    }
    throw error;
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await prisma.customer.findFirst({ where: { id, ownerId: user.id } });
  if (!existing) return jsonError(404, "Customer not found.");
  const licenses = await prisma.license.count({ where: { customerId: existing.id, ownerId: user.id } });
  if (licenses > 0) return jsonError(409, "This customer has licenses. Remove those licenses first.");
  await prisma.customer.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
