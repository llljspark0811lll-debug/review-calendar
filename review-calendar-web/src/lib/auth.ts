import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import {
  deleteUserSessionByTokenHash,
  findUserBySessionTokenHash,
  insertUserSession,
  type AppUser,
} from "@/lib/db";

const scrypt = promisify(scryptCallback);
const sessionCookieName = "review_calendar_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;

  return `scrypt:${salt}:${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [algorithm, salt, storedKey] = passwordHash.split(":");

  if (algorithm !== "scrypt" || !salt || !storedKey) {
    return false;
  }

  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  const storedKeyBuffer = Buffer.from(storedKey, "base64url");

  if (derivedKey.byteLength !== storedKeyBuffer.byteLength) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedKeyBuffer);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionMaxAgeSeconds * 1000).toISOString();

  await insertUserSession({
    id: randomUUID(),
    userId,
    tokenHash: hashSessionToken(token),
    expiresAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAgeSeconds,
  });
}

export async function getCurrentUser(): Promise<AppUser | undefined> {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (!token) {
    return undefined;
  }

  return findUserBySessionTokenHash(hashSessionToken(token));
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await deleteUserSessionByTokenHash(hashSessionToken(token));
  }

  cookieStore.delete(sessionCookieName);
}
