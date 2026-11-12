import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { serializeCustomer } from "@/lib/serializers";
import { customerSchema } from "@/lib/validation";

export async function GET(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const query = new URL(request.url).searchParams.get("q")?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      ownerId: user.id,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ customers: customers.map(serializeCustomer) });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const parsed = customerSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  try {
    const customer = await prisma.customer.create({
      data: { ownerId: user.id, name: parsed.data.name, email: parsed.data.email.toLowerCase() },
    });
    return NextResponse.json({ customer: serializeCustomer(customer) }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(409, "You already have a customer with that email.");
    }
    throw error;
  }
}
