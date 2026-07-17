import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createEmailVerificationCode,
  hashEmailVerificationCode,
  isValidEmail,
  normalizeEmail,
  sendEmailVerificationCode,
} from "@/lib/auth";
import {
  consumeRateLimit,
  findUserByEmail,
  insertEmailVerificationCode,
} from "@/lib/db";
import { toClientMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string };
    const email = normalizeEmail(body.email ?? "");

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "이메일 주소를 올바르게 입력해 주세요." },
        { status: 400 },
      );
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { message: "이미 가입된 이메일이에요." },
        { status: 400 },
      );
    }

    const rateLimit = await consumeRateLimit("send-email-code", email, 5, 60 * 60);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: "인증번호 요청이 너무 많아요. 잠시 후 다시 시도해 주세요." },
        { status: 429 },
      );
    }

    const code = createEmailVerificationCode();

    await insertEmailVerificationCode({
      id: randomUUID(),
      email,
      codeHash: hashEmailVerificationCode(email, code),
      expiresAt: new Date(Date.now() + 1000 * 60 * 10).toISOString(),
    });

    const delivery = await sendEmailVerificationCode(email, code);

    if (!delivery.sent && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { message: "이메일 발송 설정이 필요해요." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: delivery.sent
        ? "인증번호를 이메일로 보냈어요."
        : "메일 발송 설정이 없어 개발용 인증번호를 표시했어요.",
      devCode: delivery.sent || process.env.NODE_ENV === "production" ? undefined : code,
    });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "인증번호 발송 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
