import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

const BCRYPT_ROUNDS = 12;
let timingPad: Promise<string> | null = null;

function dummyHash() {
  timingPad ??= bcrypt.hash("beatledger-timing-pad", BCRYPT_ROUNDS);
  return timingPad;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function compareWithTimingPad(password: string) {
  await bcrypt.compare(password, await dummyHash());
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, email: true, name: true, createdAt: true },
  });
}
