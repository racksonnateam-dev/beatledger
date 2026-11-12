import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { clientAddress, loginLimiter } from "@/lib/rate-limit";
import { writeSessionCookie } from "@/lib/session";
import { registerSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const limited = loginLimiter.check(`register:${clientAddress(request)}:${parsed.data.email.toLowerCase()}`);
  if (!limited.allowed) {
    return jsonError(429, "Too many attempts. Try again shortly.", { retryAfterSeconds: limited.retryAfterSeconds });
  }
  try {
    const user = await prisma.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        passwordHash: await hashPassword(parsed.data.password),
      },
      select: { id: true, email: true, name: true },
    });
    await writeSessionCookie({ sub: user.id, email: user.email });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError(409, "An account with that email already exists.");
    }
    throw error;
  }
}
