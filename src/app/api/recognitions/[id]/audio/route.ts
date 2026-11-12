import { audioResponse } from "@/lib/audio-response";
import { prisma } from "@/lib/db";
import { jsonError, requireUser } from "@/lib/http";
import { ownedStorageKey } from "@/lib/storage-key";
import { getStorage } from "@/lib/storage";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const { id } = await context.params;
  const scan = await prisma.recognition.findFirst({
    where: { id, ownerId: user.id },
    select: { uploadedFilePath: true, uploadedFileName: true, mimeType: true },
  });
  if (!scan) return jsonError(404, "Scan not found.");
  try {
    ownedStorageKey(user.id, scan.uploadedFilePath);
    const bytes = await getStorage().get(scan.uploadedFilePath);
    return audioResponse(bytes, scan.mimeType, scan.uploadedFileName, request);
  } catch {
    return jsonError(404, "Scan audio not found.");
  }
}
