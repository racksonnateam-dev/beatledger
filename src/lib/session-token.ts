import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "beatledger_session";
const SESSION_TTL = "7d";

export interface SessionToken {
  sub: string;
  email: string;
}

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET is missing or shorter than 16 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(session: SessionToken) {
  return new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.sub)
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
}

export async function readSessionToken(token: string | undefined | null): Promise<SessionToken | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== "string" || typeof payload.email !== "string") return null;
    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
