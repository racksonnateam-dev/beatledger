import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { jsonError, readJson, requireUser, validationError } from "@/lib/http";
import { serializeBeat } from "@/lib/serializers";
import { ownedStorageKey } from "@/lib/storage-key";
import { getStorage } from "@/lib/storage";
import { beatMetaSchema } from "@/lib/validation";

const beatInclude = { fingerprint: true } as const;

async function ownedBeat(id: string, ownerId: string) {
  return prisma.beat.findFirst({ where: { id, ownerId }, include: beatInclude });
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const beat = await ownedBeat(id, user.id);
  if (!beat) return jsonError(404, "Beat not found.");
  return NextResponse.json({ beat: serializeBeat(beat) });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await ownedBeat(id, user.id);
  if (!existing) return jsonError(404, "Beat not found.");
  const parsed = beatMetaSchema.safeParse(await readJson(request));
  if (!parsed.success) return validationError(parsed.error);
  const beat = await prisma.beat.update({
    where: { id: existing.id },
    data: parsed.data,
    include: beatInclude,
  });
  return NextResponse.json({ beat: serializeBeat(beat) });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const existing = await ownedBeat(id, user.id);
  if (!existing) return jsonError(404, "Beat not found.");
  const licenses = await prisma.license.count({ where: { beatId: existing.id, ownerId: user.id } });
  if (licenses > 0) {
    return jsonError(409, "This beat has licenses. Remove those licenses before deleting the beat.");
  }
  if (existing.originalFilePath !== "pending") {
    try {
      ownedStorageKey(user.id, existing.originalFilePath);
      await getStorage().remove(existing.originalFilePath);
    } catch {
      // The catalogue row is still removed if the file is already gone.
    }
  }
  await prisma.beat.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
