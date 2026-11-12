import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateAudioUpload } from "@/lib/files";
import { fingerprintOwnedBeat } from "@/lib/fingerprint-job";
import { jsonError, requireUser, validationError } from "@/lib/http";
import { serializeBeat } from "@/lib/serializers";
import { getStorage } from "@/lib/storage";
import { beatMetaSchema } from "@/lib/validation";

const beatInclude = { fingerprint: true } as const;

export async function GET() {
  const { user, error } = await requireUser();
  if (!user) return error;
  const beats = await prisma.beat.findMany({
    where: { ownerId: user.id },
    include: beatInclude,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ beats: beats.map(serializeBeat) });
}

export async function POST(request: Request) {
  const { user, error } = await requireUser();
  if (!user) return error;
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError(400, "Choose an audio file.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const checked = validateAudioUpload(file.name, new Uint8Array(bytes));
  if (!checked.ok) return jsonError(400, checked.error);
  const parsed = beatMetaSchema.safeParse({
    title: form.get("title"),
    producerName: form.get("producerName") || user.name || "",
    bpm: form.get("bpm"),
    musicalKey: form.get("musicalKey"),
    genre: form.get("genre"),
  });
  if (!parsed.success) return validationError(parsed.error);

  const created = await prisma.beat.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title,
      producerName: parsed.data.producerName,
      bpm: parsed.data.bpm,
      musicalKey: parsed.data.musicalKey,
      genre: parsed.data.genre,
      originalFilePath: "pending",
      originalFileName: path.basename(file.name).slice(0, 180),
      mimeType: checked.mimeType,
      fingerprintStatus: "PENDING",
    },
  });
  const key = `users/${user.id}/beats/${created.id}/original.${checked.extension}`;
  try {
    await getStorage().put(key, bytes);
    await prisma.beat.update({ where: { id: created.id }, data: { originalFilePath: key } });
  } catch (uploadError) {
    await prisma.beat.delete({ where: { id: created.id } });
    const message = uploadError instanceof Error ? uploadError.message : "Could not store the audio file.";
    return jsonError(500, message);
  }
  await fingerprintOwnedBeat(created.id, user.id, bytes, `audio.${checked.extension}`);
  const beat = await prisma.beat.findFirst({ where: { id: created.id, ownerId: user.id }, include: beatInclude });
  return NextResponse.json({ beat: serializeBeat(beat!) }, { status: 201 });
}
