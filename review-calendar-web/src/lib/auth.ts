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
  findLatestEmailVerificationCode,
  incrementEmailVerificationAttempts,
  insertUserSession,
  consumeEmailVerificationCode,
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

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return /^[a-z0-9_]{4,20}$/.test(username);
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function createEmailVerificationCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

export function hashEmailVerificationCode(email: string, code: string) {
  return createHash("sha256")
    .update(`${normalizeEmail(email)}:${code}`)
    .digest("base64url");
}

export async function verifyEmailCode(email: string, code: string) {
  const verification = await findLatestEmailVerificationCode(email);

  if (!verification || verification.consumedAt) {
    return false;
  }

  if (verification.expiresAt <= new Date().toISOString()) {
    return false;
  }

  if (verification.attempts >= 5) {
    return false;
  }

  const expectedHash = hashEmailVerificationCode(email, code.trim());

  if (verification.codeHash !== expectedHash) {
    await incrementEmailVerificationAttempts(verification.id);
    return false;
  }

  await consumeEmailVerificationCode(verification.id);
  return true;
}

export async function sendEmailVerificationCode(email: string, code: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    console.info(`[auth] email verification code for ${email}: ${code}`);
    return { sent: false, reason: "missing-email-provider" as const };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "리뷰캘린더 이메일 인증번호",
      text: `리뷰캘린더 이메일 인증번호는 ${code}입니다. 10분 안에 입력해 주세요.`,
    }),
  });

  if (!response.ok) {
    throw new Error("인증번호 메일 발송에 실패했어요.");
  }

  return { sent: true as const };
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
