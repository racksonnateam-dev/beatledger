import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { zodMessage } from "@/lib/validation";

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, error: null };
}

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function validationError(error: ZodError) {
  return jsonError(400, zodMessage(error));
}

export function moneyNumber(value: { toString(): string } | number) {
  return Number(value.toString());
}
