import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { readJson, requireUser, validationError } from "@/lib/http";
import { profileSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const parsed = profileSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name },
    select: { id: true, email: true, name: true },
  });
  return NextResponse.json({ user: updated });
}
