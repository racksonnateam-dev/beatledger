import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fingerprintOwnedBeat } from "@/lib/fingerprint-job";
import { jsonError, requireUser } from "@/lib/http";
import { serializeBeat } from "@/lib/serializers";
import { ownedStorageKey } from "@/lib/storage-key";
import { getStorage } from "@/lib/storage";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const beat = await prisma.beat.findFirst({ where: { id, ownerId: user.id }, include: { fingerprint: true } });
  if (!beat) return jsonError(404, "Beat not found.");
  try {
    ownedStorageKey(user.id, beat.originalFilePath);
    const bytes = await getStorage().get(beat.originalFilePath);
    await fingerprintOwnedBeat(beat.id, user.id, bytes, beat.originalFileName);
  } catch (fingerprintError) {
    const message = fingerprintError instanceof Error ? fingerprintError.message : "Could not read the stored audio.";
    await prisma.beat.update({ where: { id: beat.id }, data: { fingerprintStatus: "FAILED", fingerprintError: message } });
  }
  const updated = await prisma.beat.findFirst({ where: { id: beat.id, ownerId: user.id }, include: { fingerprint: true } });
  return NextResponse.json({ beat: serializeBeat(updated!) });
}
