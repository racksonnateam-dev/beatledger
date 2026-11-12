import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type PaymentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveVerificationStatus } from "../src/lib/recognition";

function loadEnv() {
  const file = path.join(process.cwd(), ".env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function synth(seed: number, seconds = 8, sampleRate = 11025) {
  const random = mulberry32(seed);
  const count = Math.floor(seconds * sampleRate);
  const audio = new Float32Array(count);
  const frequencies = Array.from({ length: 16 }, () => 140 + random() * 840);
  const times = Array.from({ length: 52 }, () => 0.05 + random() * (seconds - 0.25)).sort((left, right) => left - right);
  times.forEach((eventTime, index) => {
    const frequency = frequencies[index % frequencies.length];
    const start = Math.floor(eventTime * sampleRate);
    const length = Math.floor(0.16 * sampleRate);
    for (let sample = 0; sample < length && start + sample < count; sample += 1) {
      const time = sample / sampleRate;
      const envelope = Math.exp(-7 * time);
      audio[start + sample] += Math.sin(2 * Math.PI * frequency * time) * envelope;
      audio[start + sample] += Math.sin(2 * Math.PI * frequency * 2.02 * time) * envelope * 0.35;
    }
  });
  let peak = 0;
  audio.forEach((sample) => {
    peak = Math.max(peak, Math.abs(sample));
  });
  const gain = 0.85 / (peak || 1);
  for (let index = 0; index < audio.length; index += 1) audio[index] *= gain;
  return audio;
}

function writeWav(filePath: string, samples: Float32Array, sampleRate: number) {
  const buffer = Buffer.alloc(44 + samples.length * 2);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + samples.length * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + index * 2);
  });
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, buffer);
}

function pythonJson(args: string[]) {
  const python = path.join(process.cwd(), "audio-service/.venv/bin/python");
  if (!existsSync(python)) return null;
  const result = spawnSync(python, ["-m", "app.cli", ...args], {
    cwd: path.join(process.cwd(), "audio-service"),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    console.warn(result.stderr || "Audio fingerprint command failed.");
    return null;
  }
  return JSON.parse(result.stdout) as {
    algorithm?: string;
    durationSeconds?: number;
    sampleRate?: number;
    hopSize?: number;
    hashCount?: number;
    hashes?: number[][];
    matches?: { beatId: string; confidence: number; matchTimestamp: number | null; queryOffset?: number | null }[];
  };
}

const demoBeats = [
  { title: "Midnight Lease", genre: "Trap", bpm: 142, musicalKey: "F#m", seed: 11 },
  { title: "Glass Alley", genre: "R&B", bpm: 96, musicalKey: "Am", seed: 23 },
  { title: "North Signal", genre: "Drill", bpm: 144, musicalKey: "Cm", seed: 37 },
  { title: "Soft Voltage", genre: "Pop", bpm: 118, musicalKey: "D", seed: 41 },
];

async function main() {
  loadEnv();
  const prisma = new PrismaClient();
  const email = "demo@beatledger.app";
  const password = "DemoBeatledger!2026";
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: "Demo Producer", passwordHash: await bcrypt.hash(password, 12) },
    create: { email, name: "Demo Producer", passwordHash: await bcrypt.hash(password, 12) },
  });

  await prisma.recognition.deleteMany({ where: { ownerId: user.id } });
  await prisma.payment.deleteMany({ where: { ownerId: user.id } });
  await prisma.license.deleteMany({ where: { ownerId: user.id } });
  await prisma.beat.deleteMany({ where: { ownerId: user.id } });
  await prisma.customer.deleteMany({ where: { ownerId: user.id } });

  const customers = await Promise.all(
    [
      ["Amina Cole", "amina@example.com"],
      ["Jules Park", "jules@example.com"],
      ["Northroom Records", "sync@northroom.example"],
    ].map(([name, customerEmail]) =>
      prisma.customer.create({ data: { ownerId: user.id, name, email: customerEmail } }),
    ),
  );

  const sampleRate = 11025;
  const createdBeats: { id: string; samples: Float32Array }[] = [];
  for (const definition of demoBeats) {
    const beat = await prisma.beat.create({
      data: {
        ownerId: user.id,
        title: definition.title,
        producerName: "Demo Producer",
        bpm: definition.bpm,
        musicalKey: definition.musicalKey,
        genre: definition.genre,
        originalFilePath: "pending",
        originalFileName: `${definition.title.replaceAll(" ", "-").toLowerCase()}.wav`,
        mimeType: "audio/wav",
        fingerprintStatus: "PENDING",
      },
    });
    const samples = synth(definition.seed);
    const key = path.join("storage", "users", user.id, "beats", beat.id, "original.wav");
    writeWav(path.join(process.cwd(), key), samples, sampleRate);
    const storageKey = `users/${user.id}/beats/${beat.id}/original.wav`;
    const fingerprint = pythonJson(["fingerprint", path.join(process.cwd(), key)]);
    if (fingerprint?.hashes) {
      const saved = await prisma.fingerprint.create({
        data: {
          beatId: beat.id,
          algorithm: fingerprint.algorithm ?? "landmark-v1",
          hopSize: fingerprint.hopSize ?? 512,
          sampleRate: fingerprint.sampleRate ?? sampleRate,
          hashCount: fingerprint.hashCount ?? fingerprint.hashes.length,
          hashes: fingerprint.hashes,
        },
      });
      await prisma.beat.update({
        where: { id: beat.id },
        data: {
          originalFilePath: storageKey,
          fingerprintStatus: "READY",
          fingerprintReference: saved.id,
          duration: fingerprint.durationSeconds ?? samples.length / sampleRate,
        },
      });
    } else {
      await prisma.beat.update({
        where: { id: beat.id },
        data: {
          originalFilePath: storageKey,
          duration: samples.length / sampleRate,
          fingerprintStatus: "FAILED",
          fingerprintError: "Seed could not reach the Python fingerprint engine. Use Retry fingerprint after the audio service environment is installed.",
        },
      });
    }
    createdBeats.push({ id: beat.id, samples });
  }

  const licensePlan: { beat: number; customer: number; type: "WAV_LEASE" | "EXCLUSIVE" | "MP3_LEASE" | "UNLIMITED"; amount: string; status: PaymentStatus; when: Date }[] = [
    { beat: 0, customer: 0, type: "WAV_LEASE", amount: "150.00", status: "PAID", when: new Date("2026-06-18T15:00:00.000Z") },
    { beat: 0, customer: 1, type: "MP3_LEASE", amount: "75.00", status: "PAID", when: new Date("2026-08-04T15:00:00.000Z") },
    { beat: 1, customer: 1, type: "UNLIMITED", amount: "400.00", status: "UNPAID", when: new Date("2026-10-02T15:00:00.000Z") },
    { beat: 2, customer: 2, type: "EXCLUSIVE", amount: "250.00", status: "PENDING", when: new Date("2026-09-12T15:00:00.000Z") },
    { beat: 2, customer: 0, type: "MP3_LEASE", amount: "500.00", status: "PAID", when: new Date("2026-11-03T15:00:00.000Z") },
  ];

  for (const plan of licensePlan) {
    const license = await prisma.license.create({
      data: {
        ownerId: user.id,
        beatId: createdBeats[plan.beat].id,
        customerId: customers[plan.customer].id,
        licenseType: plan.type,
        amount: plan.amount,
        currency: "USD",
        paymentStatus: plan.status,
        paymentDate: plan.status === "PAID" ? plan.when : null,
        createdAt: plan.when,
      },
    });
    await prisma.payment.create({
      data: {
        ownerId: user.id,
        licenseId: license.id,
        amount: plan.amount,
        currency: "USD",
        paymentMethod: plan.status === "PAID" ? "Bank transfer" : "Card",
        transactionReference: plan.status === "PAID" ? `DEMO-${plan.when.getUTCMonth() + 1}` : null,
        status: plan.status,
        createdAt: plan.when,
      },
    });
  }

  async function scanClip(beatIndex: number, startSecond: number, endSecond: number, fileName: string) {
    const beat = createdBeats[beatIndex];
    const clip = beat.samples.slice(Math.floor(startSecond * sampleRate), Math.floor(endSecond * sampleRate));
    const clipPath = path.join(process.cwd(), "storage", "users", user.id, "scans", `${beat.id}-clip.wav`);
    writeWav(clipPath, clip, sampleRate);
    const catalogue = [];
    for (const candidate of createdBeats) {
      const fingerprint = await prisma.fingerprint.findUnique({ where: { beatId: candidate.id } });
      if (fingerprint) catalogue.push({ beatId: candidate.id, hashes: fingerprint.hashes });
    }
    const cataloguePath = path.join(process.cwd(), "storage", "users", user.id, "scans", "catalogue.json");
    writeFileSync(cataloguePath, JSON.stringify(catalogue));
    const matched = pythonJson(["match", clipPath, cataloguePath]);
    const hit = matched?.matches?.find((item) => item.beatId === beat.id);
    if (!hit) {
      console.warn(`Seed did not store a scan for ${fileName} because the engine returned no real match.`);
      return;
    }
    const licenses = await prisma.license.findMany({ where: { ownerId: user.id, beatId: hit.beatId } });
    const status = resolveVerificationStatus({
      processingFailed: false,
      matched: true,
      licenses: licenses.map((license) => ({ paymentStatus: license.paymentStatus, expirationDate: license.expirationDate })),
      now: new Date("2026-11-12T12:00:00.000Z"),
    });
    await prisma.recognition.create({
      data: {
        ownerId: user.id,
        uploadedFilePath: `users/${user.id}/scans/${path.basename(clipPath)}`,
        uploadedFileName: fileName,
        mimeType: "audio/wav",
        matchedBeatId: hit.beatId,
        confidenceScore: hit.confidence,
        matchTimestamp: hit.matchTimestamp,
        queryOffset: hit.queryOffset ?? null,
        verificationStatus: status,
        engine: "landmark-v1",
        experimental: true,
        createdAt: new Date("2026-11-10T18:00:00.000Z"),
      },
    });
  }

  await scanClip(0, 3, 5.6, "midnight-excerpt.wav");
  await scanClip(3, 1.2, 4, "soft-voltage-excerpt.wav");

  const noisePath = path.join(process.cwd(), "storage", "users", user.id, "scans", "unrelated.wav");
  writeWav(noisePath, synth(99, 4), sampleRate);
  const catalogue = [];
  for (const candidate of createdBeats) {
    const fingerprint = await prisma.fingerprint.findUnique({ where: { beatId: candidate.id } });
    if (fingerprint) catalogue.push({ beatId: candidate.id, hashes: fingerprint.hashes });
  }
  const cataloguePath = path.join(process.cwd(), "storage", "users", user.id, "scans", "catalogue.json");
  writeFileSync(cataloguePath, JSON.stringify(catalogue));
  const unrelated = pythonJson(["match", noisePath, cataloguePath]);
  if (unrelated && (unrelated.matches?.length ?? 0) === 0) {
    await prisma.recognition.create({
      data: {
        ownerId: user.id,
        uploadedFilePath: `users/${user.id}/scans/unrelated.wav`,
        uploadedFileName: "unrelated-idea.wav",
        mimeType: "audio/wav",
        verificationStatus: "NO_MATCH",
        engine: "landmark-v1",
        experimental: true,
        engineMessage: "No confident match was found in your catalogue.",
        createdAt: new Date("2026-11-11T16:30:00.000Z"),
      },
    });
  }

  console.log(`Seeded ${email} / ${password}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
