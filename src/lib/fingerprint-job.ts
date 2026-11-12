import { Prisma } from "@prisma/client";
import { fingerprintAudio } from "@/lib/audio-service";
import { prisma } from "@/lib/db";

export async function fingerprintOwnedBeat(beatId: string, ownerId: string, bytes: Buffer, filename: string) {
  const beat = await prisma.beat.findFirst({ where: { id: beatId, ownerId }, select: { id: true } });
  if (!beat) return;
  try {
    const fingerprint = await fingerprintAudio(bytes, filename);
    const saved = await prisma.$transaction(async (tx) => {
      await tx.fingerprint.deleteMany({ where: { beatId } });
      return tx.fingerprint.create({
        data: {
          beatId,
          algorithm: fingerprint.algorithm,
          hopSize: fingerprint.hopSize,
          sampleRate: fingerprint.sampleRate,
          hashCount: fingerprint.hashCount,
          hashes: fingerprint.hashes as Prisma.InputJsonValue,
        },
      });
    });
    await prisma.beat.update({
      where: { id: beatId },
      data: {
        fingerprintStatus: "READY",
        fingerprintError: null,
        fingerprintReference: saved.id,
        duration: fingerprint.durationSeconds,
      },
    });
  } catch (error) {
    await prisma.beat.update({
      where: { id: beatId },
      data: {
        fingerprintStatus: "FAILED",
        fingerprintError: error instanceof Error ? error.message : "Fingerprinting failed.",
      },
    });
  }
}
