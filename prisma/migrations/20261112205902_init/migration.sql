-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID', 'PENDING', 'REFUNDED');

-- CreateEnum
CREATE TYPE "LicenseType" AS ENUM ('MP3_LEASE', 'WAV_LEASE', 'TRACKOUT', 'UNLIMITED', 'EXCLUSIVE');

-- CreateEnum
CREATE TYPE "FingerprintStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('LICENSED', 'UNVERIFIED_LICENSE', 'NO_MATCH', 'PROCESSING_FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Beat" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "producerName" TEXT NOT NULL,
    "bpm" INTEGER,
    "musicalKey" TEXT,
    "genre" TEXT,
    "originalFilePath" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fingerprintReference" TEXT,
    "fingerprintStatus" "FingerprintStatus" NOT NULL DEFAULT 'PENDING',
    "fingerprintError" TEXT,
    "duration" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Beat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fingerprint" (
    "id" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "hopSize" INTEGER NOT NULL,
    "sampleRate" INTEGER NOT NULL,
    "hashCount" INTEGER NOT NULL,
    "hashes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Fingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "License" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "beatId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "licenseType" "LicenseType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "License_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recognition" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "uploadedFilePath" TEXT NOT NULL,
    "uploadedFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "matchedBeatId" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "matchTimestamp" DOUBLE PRECISION,
    "queryOffset" DOUBLE PRECISION,
    "verificationStatus" "VerificationStatus" NOT NULL,
    "engine" TEXT NOT NULL,
    "experimental" BOOLEAN NOT NULL DEFAULT true,
    "engineMessage" TEXT,
    "alternates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recognition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "transactionReference" TEXT,
    "status" "PaymentStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Beat_ownerId_createdAt_idx" ON "Beat"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Fingerprint_beatId_key" ON "Fingerprint"("beatId");

-- CreateIndex
CREATE INDEX "Customer_ownerId_name_idx" ON "Customer"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_ownerId_email_key" ON "Customer"("ownerId", "email");

-- CreateIndex
CREATE INDEX "License_ownerId_paymentStatus_idx" ON "License"("ownerId", "paymentStatus");

-- CreateIndex
CREATE INDEX "License_beatId_idx" ON "License"("beatId");

-- CreateIndex
CREATE INDEX "License_customerId_idx" ON "License"("customerId");

-- CreateIndex
CREATE INDEX "Recognition_ownerId_createdAt_idx" ON "Recognition"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "Recognition_matchedBeatId_idx" ON "Recognition"("matchedBeatId");

-- CreateIndex
CREATE INDEX "Payment_ownerId_status_idx" ON "Payment"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Payment_licenseId_idx" ON "Payment"("licenseId");

-- AddForeignKey
ALTER TABLE "Beat" ADD CONSTRAINT "Beat_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fingerprint" ADD CONSTRAINT "Fingerprint_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_beatId_fkey" FOREIGN KEY ("beatId") REFERENCES "Beat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "License" ADD CONSTRAINT "License_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recognition" ADD CONSTRAINT "Recognition_matchedBeatId_fkey" FOREIGN KEY ("matchedBeatId") REFERENCES "Beat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "License"("id") ON DELETE CASCADE ON UPDATE CASCADE;
