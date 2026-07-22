import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  isValidEmail,
  isValidUsername,
  normalizeEmail,
  normalizeUsername,
  verifyEmailCode,
} from "@/lib/auth";
import { findUserByEmail, findUserByUsername, insertUser } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      email?: string;
      name?: string;
      password?: string;
      passwordConfirm?: string;
      emailCode?: string;
    };
    const username = normalizeUsername(body.username ?? "");
    const email = normalizeEmail(body.email ?? "");
    const name = body.name?.trim() || username;
    const password = body.password ?? "";
    const passwordConfirm = body.passwordConfirm ?? "";
    const emailCode = body.emailCode?.trim() ?? "";

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { message: "아이디는 영문 소문자, 숫자로 4-20자 입력해 주세요." },
        { status: 400 },
      );
    }

    if (await findUserByUsername(username)) {
      return NextResponse.json(
        { message: "이미 사용 중인 아이디예요." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "비밀번호는 8자 이상으로 입력해 주세요." },
        { status: 400 },
      );
    }

    if (password !== passwordConfirm) {
      return NextResponse.json(
        { message: "비밀번호 확인이 일치하지 않아요." },
        { status: 400 },
      );
    }

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

    if (!emailCode || !(await verifyEmailCode(email, emailCode))) {
      return NextResponse.json(
        { message: "이메일 인증번호를 확인해 주세요." },
        { status: 400 },
      );
    }

    const user = await insertUser({
      id: randomUUID(),
      username,
      email,
      name,
      passwordHash: await hashPassword(password),
    });

    await createSession(user.id);
    await sendTelegramMessage(
      `🆕 새 회원가입\n아이디: ${user.username}\n이메일: ${user.email}`,
    );

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "회원가입 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
