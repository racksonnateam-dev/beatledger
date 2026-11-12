import { NextResponse } from "next/server";
import { compareWithTimingPad, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, readJson, validationError } from "@/lib/http";
import { clientAddress, loginLimiter } from "@/lib/rate-limit";
import { writeSessionCookie } from "@/lib/session";
import { loginSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const email = parsed.data.email.toLowerCase();
  const limited = loginLimiter.check(`login:${clientAddress(request)}:${email}`);
  if (!limited.allowed) {
    return jsonError(429, "Too many attempts. Try again shortly.", { retryAfterSeconds: limited.retryAfterSeconds });
  }
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    await compareWithTimingPad(parsed.data.password);
    return jsonError(401, "Invalid email or password.");
  }
  const matches = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!matches) return jsonError(401, "Invalid email or password.");
  await writeSessionCookie({ sub: user.id, email: user.email });
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
