export type PaymentStatus = "PAID" | "UNPAID" | "PENDING" | "REFUNDED";
export type VerificationStatus = "LICENSED" | "UNVERIFIED_LICENSE" | "NO_MATCH" | "PROCESSING_FAILED";

export interface LicenseCoverage {
  paymentStatus: PaymentStatus;
  expirationDate: Date | null;
}

export function licenseCoversDetection(license: LicenseCoverage, now: Date) {
  if (license.paymentStatus !== "PAID") return false;
  if (license.expirationDate && license.expirationDate.getTime() <= now.getTime()) return false;
  return true;
}

export function resolveVerificationStatus(input: {
  processingFailed: boolean;
  matched: boolean;
  licenses: LicenseCoverage[];
  now: Date;
}): VerificationStatus {
  if (input.processingFailed) return "PROCESSING_FAILED";
  if (!input.matched) return "NO_MATCH";
  const covered = input.licenses.some((license) => licenseCoversDetection(license, input.now));
  return covered ? "LICENSED" : "UNVERIFIED_LICENSE";
}

export function verificationLabel(status: VerificationStatus) {
  switch (status) {
    case "LICENSED":
      return "Licensed";
    case "UNVERIFIED_LICENSE":
      return "Unverified license";
    case "NO_MATCH":
      return "No match found";
    case "PROCESSING_FAILED":
      return "Processing failed";
  }
}

export function verificationCopy(status: VerificationStatus) {
  switch (status) {
    case "LICENSED":
      return "This upload matches a beat in your catalogue, and a paid license on file covers it.";
    case "UNVERIFIED_LICENSE":
      return "This upload matches a beat in your catalogue. No active paid license covers it. A missing payment record is not proof of copyright infringement.";
    case "NO_MATCH":
      return "No confident match was found in your catalogue.";
    case "PROCESSING_FAILED":
      return "The recognition engine could not process this file. Nothing was compared.";
  }
}

export interface EngineMatch {
  beatId: string;
  confidence: number;
  votes: number;
  offsetFrames: number;
  matchTimestamp: number | null;
  queryOffset: number | null;
}

export type MatchInterpretation =
  | { kind: "failed"; message: string }
  | { kind: "no_match" }
  | { kind: "matched"; matches: EngineMatch[] };

function asMatch(value: unknown): EngineMatch | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.beatId !== "string" || record.beatId.length === 0) return null;
  if (typeof record.confidence !== "number" || !Number.isFinite(record.confidence)) return null;
  if (record.confidence < 0 || record.confidence > 1) return null;
  return {
    beatId: record.beatId,
    confidence: record.confidence,
    votes: typeof record.votes === "number" && Number.isFinite(record.votes) ? record.votes : 0,
    offsetFrames:
      typeof record.offsetFrames === "number" && Number.isFinite(record.offsetFrames) ? record.offsetFrames : 0,
    matchTimestamp:
      typeof record.matchTimestamp === "number" && Number.isFinite(record.matchTimestamp)
        ? record.matchTimestamp
        : null,
    queryOffset:
      typeof record.queryOffset === "number" && Number.isFinite(record.queryOffset) ? record.queryOffset : null,
  };
}

export function interpretMatchResponse(ok: boolean, body: unknown, fallbackMessage: string): MatchInterpretation {
  if (!ok) {
    const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const message =
      typeof record.error === "string"
        ? record.error
        : typeof record.detail === "string"
          ? record.detail
          : fallbackMessage;
    return { kind: "failed", message };
  }
  if (!body || typeof body !== "object" || !Array.isArray((body as { matches?: unknown }).matches)) {
    return { kind: "failed", message: "Audio service returned an unexpected response." };
  }
  const raw = (body as { matches: unknown[] }).matches;
  const matches = raw.flatMap((item) => {
    const match = asMatch(item);
    return match ? [match] : [];
  });
  if (raw.length > 0 && matches.length === 0) {
    return { kind: "failed", message: "Audio service returned an unreadable match." };
  }
  if (matches.length === 0) return { kind: "no_match" };
  return { kind: "matched", matches };
}

export interface FingerprintPayload {
  algorithm: string;
  experimental: boolean;
  durationSeconds: number;
  sampleRate: number;
  hopSize: number;
  hashCount: number;
  hashes: number[][];
}

export interface PlatformLink {
  platform: string;
  url: string;
}

export interface PlatformMatch {
  title: string | null;
  artist: string | null;
  album: string | null;
  timecode: string | null;
  links: PlatformLink[];
}

export interface PlatformReport {
  status: "not_configured" | "matched" | "no_match" | "failed";
  message: string;
  matches: PlatformMatch[];
}

const PLATFORM_HOSTS: Record<string, string> = {
  "open.spotify.com": "Spotify",
  "music.apple.com": "Apple Music",
  "song.link": "Songlink",
  "www.song.link": "Songlink",
  "lis.tn": "Songlink",
};

function allowedPlatformLink(url: unknown): PlatformLink | null {
  if (typeof url !== "string" || !url.startsWith("https://")) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    const platform = PLATFORM_HOSTS[host];
    if (!platform) return null;
    return { platform, url };
  } catch {
    return null;
  }
}

export function sanitizePlatformReport(body: unknown): PlatformReport {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const status = record.status;
  const safeStatus =
    status === "matched" || status === "no_match" || status === "failed" || status === "not_configured"
      ? status
      : "failed";
  const message =
    typeof record.message === "string" && record.message.trim()
      ? record.message.trim().slice(0, 500)
      : "Song identification did not return a recording.";
  if (safeStatus !== "matched" || !Array.isArray(record.matches)) {
    return { status: safeStatus === "matched" ? "failed" : safeStatus, message, matches: [] };
  }
  const matches = record.matches.flatMap((item): PlatformMatch[] => {
    if (!item || typeof item !== "object") return [];
    const match = item as Record<string, unknown>;
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim().slice(0, 200) : null);
    const links = Array.isArray(match.links)
      ? match.links.flatMap((link) => {
          const parsed = link && typeof link === "object" ? allowedPlatformLink((link as { url?: unknown }).url) : null;
          return parsed ? [parsed] : [];
        })
      : [];
    const title = text(match.title);
    const artist = text(match.artist);
    if (!title && !artist && links.length === 0) return [];
    return [{ title, artist, album: text(match.album), timecode: text(match.timecode), links }];
  });
  if (matches.length === 0) {
    return { status: "failed", message: "Song identification returned an unreadable recording.", matches: [] };
  }
  return { status: "matched", message, matches };
}

export function parseFingerprint(body: unknown): FingerprintPayload {
  if (!body || typeof body !== "object") {
    throw new Error("Audio service returned an unexpected fingerprint.");
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.hashes) || typeof record.algorithm !== "string") {
    throw new Error("Audio service returned an unexpected fingerprint.");
  }
  const hashes = record.hashes.filter((item): item is number[] => {
    return Array.isArray(item) && item.length >= 4 && item.slice(0, 4).every((part) => typeof part === "number");
  });
  if (hashes.length !== record.hashes.length) {
    throw new Error("Audio service returned a damaged fingerprint.");
  }
  const duration = typeof record.durationSeconds === "number" ? record.durationSeconds : 0;
  return {
    algorithm: record.algorithm,
    experimental: record.experimental !== false,
    durationSeconds: duration,
    sampleRate: typeof record.sampleRate === "number" ? record.sampleRate : 0,
    hopSize: typeof record.hopSize === "number" ? record.hopSize : 0,
    hashCount: hashes.length,
    hashes: hashes.map((item) => item.slice(0, 4)),
  };
}
