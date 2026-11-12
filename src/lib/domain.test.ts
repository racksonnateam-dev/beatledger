import { describe, expect, it } from "vitest";
import { validateAudioUpload } from "@/lib/files";
import { formatMoney } from "@/lib/format";
import {
  interpretMatchResponse,
  parseFingerprint,
  resolveVerificationStatus,
  verificationCopy,
  verificationLabel,
} from "@/lib/recognition";
import { SlidingWindowLimiter } from "@/lib/rate-limit";
import { assertSafeStorageKey, ownedStorageKey } from "@/lib/storage-key";
import { beatMetaSchema, registerSchema } from "@/lib/validation";

const now = new Date("2026-11-12T12:00:00.000Z");

describe("verification status", () => {
  it("does not treat a missing license as infringement", () => {
    const status = resolveVerificationStatus({ processingFailed: false, matched: true, licenses: [], now });
    expect(status).toBe("UNVERIFIED_LICENSE");
    expect(verificationLabel(status)).toBe("Unverified license");
    expect(verificationCopy(status)).not.toMatch(/^Copyright infringement/);
  });

  it("requires a paid, unexpired license before marking a detection licensed", () => {
    expect(
      resolveVerificationStatus({
        processingFailed: false,
        matched: true,
        licenses: [{ paymentStatus: "UNPAID", expirationDate: null }],
        now,
      }),
    ).toBe("UNVERIFIED_LICENSE");
    expect(
      resolveVerificationStatus({
        processingFailed: false,
        matched: true,
        licenses: [{ paymentStatus: "PENDING", expirationDate: null }],
        now,
      }),
    ).toBe("UNVERIFIED_LICENSE");
    expect(
      resolveVerificationStatus({
        processingFailed: false,
        matched: true,
        licenses: [{ paymentStatus: "REFUNDED", expirationDate: null }],
        now,
      }),
    ).toBe("UNVERIFIED_LICENSE");
    expect(
      resolveVerificationStatus({
        processingFailed: false,
        matched: true,
        licenses: [{ paymentStatus: "PAID", expirationDate: new Date("2026-11-01T00:00:00.000Z") }],
        now,
      }),
    ).toBe("UNVERIFIED_LICENSE");
    expect(
      resolveVerificationStatus({
        processingFailed: false,
        matched: true,
        licenses: [
          { paymentStatus: "UNPAID", expirationDate: null },
          { paymentStatus: "PAID", expirationDate: new Date("2027-01-01T00:00:00.000Z") },
        ],
        now,
      }),
    ).toBe("LICENSED");
  });

  it("keeps engine failures and misses distinct from license state", () => {
    expect(
      resolveVerificationStatus({
        processingFailed: true,
        matched: true,
        licenses: [{ paymentStatus: "PAID", expirationDate: null }],
        now,
      }),
    ).toBe("PROCESSING_FAILED");
    expect(
      resolveVerificationStatus({
        processingFailed: false,
        matched: false,
        licenses: [{ paymentStatus: "PAID", expirationDate: null }],
        now,
      }),
    ).toBe("NO_MATCH");
  });
});

describe("match interpretation", () => {
  it("does not turn a failed engine call into a clean miss or a fabricated hit", () => {
    expect(interpretMatchResponse(false, { matches: [], error: "Audio service is not reachable." }, "failed")).toEqual({
      kind: "failed",
      message: "Audio service is not reachable.",
    });
    expect(interpretMatchResponse(true, { matches: [{ beatId: "b1" }] }, "failed").kind).toBe("failed");
    expect(interpretMatchResponse(true, { matches: [] }, "failed")).toEqual({ kind: "no_match" });
    const matched = interpretMatchResponse(
      true,
      { matches: [{ beatId: "b1", confidence: 0.42, votes: 20, offsetFrames: 10, matchTimestamp: 1.2, queryOffset: 0 }] },
      "failed",
    );
    expect(matched.kind).toBe("matched");
  });

  it("rejects a fingerprint that is not a real hash list", () => {
    expect(() => parseFingerprint({ algorithm: "landmark-v1", hashes: [[1, 2, "x", 4]] })).toThrow(/damaged/);
    expect(parseFingerprint({ algorithm: "landmark-v1", experimental: true, durationSeconds: 2, hashes: [[1, 2, 3, 4]] }).hashCount).toBe(1);
  });
});

describe("uploads and storage keys", () => {
  it("accepts a real WAV header and rejects a renamed text file", () => {
    const wav = new Uint8Array(44);
    wav.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(validateAudioUpload("loop.wav", wav).ok).toBe(true);
    expect(validateAudioUpload("loop.wav", new TextEncoder().encode("not audio")).ok).toBe(false);
    expect(validateAudioUpload("loop.exe", wav).ok).toBe(false);
  });

  it("blocks path traversal and cross-account keys", () => {
    expect(() => assertSafeStorageKey("../secrets.env")).toThrow(/Invalid storage key/);
    expect(() => assertSafeStorageKey("/etc/passwd")).toThrow(/Invalid storage key/);
    expect(assertSafeStorageKey("users/user_1/beats/a.wav").key).toBe("users/user_1/beats/a.wav");
    expect(() => ownedStorageKey("user_1", "users/user_2/beats/a.wav")).toThrow(/outside this account/);
  });
});

describe("rate limit", () => {
  it("blocks the request that crosses the window", () => {
    const limiter = new SlidingWindowLimiter(2, 10_000);
    expect(limiter.check("user", 0).allowed).toBe(true);
    expect(limiter.check("user", 1).allowed).toBe(true);
    const blocked = limiter.check("user", 2);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(limiter.check("user", 10_001).allowed).toBe(true);
  });
});

describe("form validation", () => {
  it("rejects weak passwords and impossible tempos", () => {
    expect(registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "longpassword" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "longpassword1" }).success).toBe(true);
    expect(
      beatMetaSchema.safeParse({ title: "Night", producerName: "Ada", bpm: 20, musicalKey: "", genre: "" }).success,
    ).toBe(false);
    expect(formatMoney(1250)).toBe("$1,250.00");
  });
});
