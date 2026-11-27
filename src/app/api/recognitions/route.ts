import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { identifyPlatforms, matchAudio } from "@/lib/audio-service";
import { prisma } from "@/lib/db";
import { validateAudioUpload } from "@/lib/files";
import { jsonError, requireUser } from "@/lib/http";
import { verificationCopy, type EngineMatch } from "@/lib/recognition";
import { resolveVerificationStatus } from "@/lib/recognition";
import { serializeRecognition } from "@/lib/serializers";
import { getStorage } from "@/lib/storage";

const recognitionInclude = {
  matchedBeat: { select: { id: true, title: true, producerName: true } },
} as const;

function hashesOf(value: Prisma.JsonValue): number[][] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number[] => Array.isArray(item));
}

export async function GET() {
  const { user, error } = await requireUser();
  if (!user) return error;
  const rows = await prisma.recognition.findMany({
    where: { ownerId: user.id },
    include: recognitionInclude,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const beatIds = rows.flatMap((row) => (row.matchedBeatId ? [row.matchedBeatId] : []));
  const licenses = await prisma.license.findMany({
    where: { ownerId: user.id, beatId: { in: beatIds } },
    include: { customer: { select: { name: true } } },
  });
  return NextResponse.json({
    recognitions: rows.map((row) =>
      serializeRecognition(
        row,
        licenses
          .filter((license) => license.beatId === row.matchedBeatId)
          .map((license) => ({
            id: license.id,
            paymentStatus: license.paymentStatus,
            expirationDate: license.expirationDate,
            customerName: license.customer.name,
            licenseType: license.licenseType,
            amount: Number(license.amount),
            currency: license.currency,
          })),
      ),
    ),
  });
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

  const scanKey = `users/${user.id}/scans/${crypto.randomUUID()}/query.${checked.extension}`;
  await getStorage().put(scanKey, bytes);
  const fileName = file.name.split(/[/\\]/).pop()?.slice(0, 180) || "upload";

  const catalogueRows = await prisma.fingerprint.findMany({
    where: { beat: { ownerId: user.id, fingerprintStatus: "READY" } },
    include: { beat: { select: { id: true } } },
    take: 200,
  });
  const catalogue = catalogueRows.map((row) => ({ beatId: row.beat.id, hashes: hashesOf(row.hashes) }));
  const known = new Set(catalogue.map((item) => item.beatId));

  let engine = "landmark-v1";
  let experimental = true;
  let primary: EngineMatch | null = null;
  let alternates: EngineMatch[] = [];
  let status: "LICENSED" | "UNVERIFIED_LICENSE" | "NO_MATCH" | "PROCESSING_FAILED" = "NO_MATCH";
  let message = "No fingerprinted beats are in your catalogue, so there was nothing to compare.";

  if (catalogue.length > 0) {
    const result = await matchAudio(bytes, `query.${checked.extension}`, catalogue);
    if (result.kind === "failed") {
      status = "PROCESSING_FAILED";
      message = result.message;
      engine = "unavailable";
    } else if (result.kind === "no_match") {
      status = "NO_MATCH";
      message = verificationCopy("NO_MATCH");
    } else {
      const real = result.matches.filter((match) => known.has(match.beatId));
      if (real.length === 0) {
        status = "NO_MATCH";
        message = verificationCopy("NO_MATCH");
      } else {
        primary = real[0];
        alternates = real.slice(1);
      }
    }
  }

  const related = primary
    ? await prisma.license.findMany({
        where: { ownerId: user.id, beatId: primary.beatId },
        include: { customer: { select: { name: true } } },
      })
    : [];

  if (primary) {
    status = resolveVerificationStatus({
      processingFailed: false,
      matched: true,
      licenses: related.map((license) => ({
        paymentStatus: license.paymentStatus,
        expirationDate: license.expirationDate,
      })),
      now: new Date(),
    });
    message = verificationCopy(status);
  }

  const platform = await identifyPlatforms(bytes, `query.${checked.extension}`);

  const created = await prisma.recognition.create({
    data: {
      ownerId: user.id,
      uploadedFilePath: scanKey,
      uploadedFileName: fileName,
      mimeType: checked.mimeType,
      matchedBeatId: primary?.beatId ?? null,
      confidenceScore: primary?.confidence ?? null,
      matchTimestamp: primary?.matchTimestamp ?? null,
      queryOffset: primary?.queryOffset ?? null,
      verificationStatus: status,
      engine,
      experimental,
      engineMessage: message,
      alternates: alternates.map((match) => ({
        beatId: match.beatId,
        confidence: match.confidence,
        matchTimestamp: match.matchTimestamp,
      })),
      platformStatus: platform.status,
      platformMessage: platform.message,
      platformMatches: platform.matches as unknown as Prisma.InputJsonValue,
    },
    include: recognitionInclude,
  });

  return NextResponse.json(
    {
      recognition: serializeRecognition(
        created,
        related.map((license) => ({
          id: license.id,
          paymentStatus: license.paymentStatus,
          expirationDate: license.expirationDate,
          customerName: license.customer.name,
          licenseType: license.licenseType,
          amount: Number(license.amount),
          currency: license.currency,
        })),
      ),
    },
    { status: 201 },
  );
}
