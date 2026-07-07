import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  isValidEmail,
  normalizeEmail,
} from "@/lib/auth";
import { findUserByEmail, insertUser } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
    };
    const email = normalizeEmail(body.email ?? "");
    const name = body.name?.trim() || "사용자";
    const password = body.password ?? "";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "이메일 주소를 올바르게 입력해 주세요." },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { message: "비밀번호는 8자 이상으로 입력해 주세요." },
        { status: 400 },
      );
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { message: "이미 가입된 이메일이에요." },
        { status: 400 },
      );
    }

    const user = await insertUser({
      id: randomUUID(),
      email,
      name,
      passwordHash: await hashPassword(password),
    });

    await createSession(user.id);

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "회원가입 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
