import { NextResponse } from "next/server";
import {
  createSession,
  isValidEmail,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = normalizeEmail(body.email ?? "");
    const password = body.password ?? "";

    if (!isValidEmail(email) || !password) {
      return NextResponse.json(
        { message: "이메일과 비밀번호를 확인해 주세요." },
        { status: 400 },
      );
    }

    const userWithPassword = await findUserByEmail(email);

    if (
      !userWithPassword ||
      !(await verifyPassword(password, userWithPassword.passwordHash))
    ) {
      return NextResponse.json(
        { message: "이메일 또는 비밀번호가 맞지 않아요." },
        { status: 401 },
      );
    }

    await createSession(userWithPassword.id);

    return NextResponse.json({
      user: {
        id: userWithPassword.id,
        email: userWithPassword.email,
        name: userWithPassword.name,
        createdAt: userWithPassword.createdAt,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "로그인 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
