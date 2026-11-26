-- AlterTable
ALTER TABLE "Recognition" ADD COLUMN "platformStatus" TEXT,
ADD COLUMN "platformMessage" TEXT,
ADD COLUMN "platformMatches" JSONB;
