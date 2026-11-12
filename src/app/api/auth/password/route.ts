import { NextResponse } from "next/server";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { passwordChangeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const parsed = passwordChangeSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) return jsonError(401, "Unauthorized");
  const matches = await verifyPassword(parsed.data.currentPassword, record.passwordHash);
  if (!matches) return jsonError(400, "Current password is incorrect.");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword) },
  });
  return NextResponse.json({ ok: true });
}
