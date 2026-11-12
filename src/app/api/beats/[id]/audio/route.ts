import { audioResponse } from "@/lib/audio-response";
import { prisma } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/http";
import { ownedStorageKey } from "@/lib/storage-key";
import { getStorage } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const beat = await prisma.beat.findFirst({
    where: { id, ownerId: user.id },
    select: { originalFilePath: true, originalFileName: true, mimeType: true },
  });
  if (!beat || beat.originalFilePath === "pending") return jsonError(404, "Audio not found.");
  try {
    ownedStorageKey(user.id, beat.originalFilePath);
    const bytes = await getStorage().get(beat.originalFilePath);
    return audioResponse(bytes, beat.mimeType, beat.originalFileName, request);
  } catch {
    return jsonError(404, "Audio not found.");
  }
}
