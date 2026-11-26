import type { Beat, Customer, Fingerprint, License, Payment, Recognition } from "@prisma/client";
import { moneyNumber } from "@/lib/http";
import {
  resolveVerificationStatus,
  sanitizePlatformReport,
  verificationCopy,
  verificationLabel,
  type VerificationStatus,
} from "@/lib/recognition";

export function serializeBeat(beat: Beat & { fingerprint?: Fingerprint | null }) {
  return {
    id: beat.id,
    title: beat.title,
    producerName: beat.producerName,
    bpm: beat.bpm,
    musicalKey: beat.musicalKey,
    genre: beat.genre,
    mimeType: beat.mimeType,
    originalFileName: beat.originalFileName,
    fingerprintStatus: beat.fingerprintStatus,
    fingerprintError: beat.fingerprintError,
    hashCount: beat.fingerprint?.hashCount ?? null,
    algorithm: beat.fingerprint?.algorithm ?? null,
    duration: beat.duration,
    createdAt: beat.createdAt.toISOString(),
    audioUrl: `/api/beats/${beat.id}/audio`,
  };
}

export function serializeCustomer(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    createdAt: customer.createdAt.toISOString(),
  };
}

type LicenseWithRelations = License & {
  beat: { id: string; title: string };
  customer: { id: string; name: string; email: string };
};

export function serializeLicense(license: LicenseWithRelations) {
  return {
    id: license.id,
    beatId: license.beatId,
    beatTitle: license.beat.title,
    customerId: license.customerId,
    customerName: license.customer.name,
    customerEmail: license.customer.email,
    licenseType: license.licenseType,
    amount: moneyNumber(license.amount),
    currency: license.currency,
    paymentStatus: license.paymentStatus,
    paymentDate: license.paymentDate?.toISOString() ?? null,
    expirationDate: license.expirationDate?.toISOString() ?? null,
    notes: license.notes,
    createdAt: license.createdAt.toISOString(),
  };
}

type PaymentWithLicense = Payment & {
  license: { id: string; beat: { title: string }; customer: { name: string } };
};

export function serializePayment(payment: PaymentWithLicense) {
  return {
    id: payment.id,
    licenseId: payment.licenseId,
    beatTitle: payment.license.beat.title,
    customerName: payment.license.customer.name,
    amount: moneyNumber(payment.amount),
    currency: payment.currency,
    paymentMethod: payment.paymentMethod,
    transactionReference: payment.transactionReference,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
  };
}

export function statusForRecognition(
  recognition: Pick<Recognition, "verificationStatus" | "matchedBeatId">,
  licenses: { paymentStatus: "PAID" | "UNPAID" | "PENDING" | "REFUNDED"; expirationDate: Date | null }[],
  now = new Date(),
): { status: VerificationStatus; note: string | null } {
  if (recognition.verificationStatus === "PROCESSING_FAILED") {
    return { status: "PROCESSING_FAILED", note: null };
  }
  if (recognition.verificationStatus === "NO_MATCH" || !recognition.matchedBeatId) {
    if (!recognition.matchedBeatId && recognition.verificationStatus !== "NO_MATCH") {
      return { status: "UNVERIFIED_LICENSE", note: "The matched beat is no longer in your catalogue." };
    }
    return { status: "NO_MATCH", note: null };
  }
  const status = resolveVerificationStatus({
    processingFailed: false,
    matched: true,
    licenses,
    now,
  });
  return { status, note: null };
}

export function serializeRecognition(
  recognition: Recognition & { matchedBeat: { id: string; title: string; producerName: string } | null },
  licenses: { id: string; paymentStatus: "PAID" | "UNPAID" | "PENDING" | "REFUNDED"; expirationDate: Date | null; customerName?: string; licenseType?: string; amount?: number; currency?: string }[],
) {
  const live = statusForRecognition(recognition, licenses);
  return {
    id: recognition.id,
    fileName: recognition.uploadedFileName,
    audioUrl: `/api/recognitions/${recognition.id}/audio`,
    status: live.status,
    statusLabel: verificationLabel(live.status),
    message: live.note ?? recognition.engineMessage ?? verificationCopy(live.status),
    experimental: recognition.experimental,
    engine: recognition.engine,
    confidence: recognition.confidenceScore,
    matchTimestamp: recognition.matchTimestamp,
    queryOffset: recognition.queryOffset,
    createdAt: recognition.createdAt.toISOString(),
    beat: recognition.matchedBeat,
    licenses: licenses.map((license) => ({
      id: license.id,
      paymentStatus: license.paymentStatus,
      expirationDate: license.expirationDate?.toISOString() ?? null,
      customerName: license.customerName ?? null,
      licenseType: license.licenseType ?? null,
      amount: license.amount ?? null,
      currency: license.currency ?? null,
    })),
    alternates: recognition.alternates ?? [],
    platform: sanitizePlatformReport({
      status: recognition.platformStatus ?? "not_configured",
      message:
        recognition.platformMessage ??
        "This scan did not check a released-music database. Run it again after song identification is configured.",
      matches: recognition.platformMatches ?? [],
    }),
  };
}
