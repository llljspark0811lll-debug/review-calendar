import { NextResponse } from "next/server";
import {
  createSession,
  isValidUsername,
  normalizeUsername,
  verifyPassword,
} from "@/lib/auth";
import { findUserByUsername } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    const username = normalizeUsername(body.username ?? "");
    const password = body.password ?? "";

    if (!isValidUsername(username) || !password) {
      return NextResponse.json(
        { message: "아이디와 비밀번호를 확인해 주세요." },
        { status: 400 },
      );
    }

    const userWithPassword = await findUserByUsername(username);

    if (
      !userWithPassword ||
      !(await verifyPassword(password, userWithPassword.passwordHash))
    ) {
      return NextResponse.json(
        { message: "아이디 또는 비밀번호가 맞지 않아요." },
        { status: 401 },
      );
    }

    await createSession(userWithPassword.id);

    return NextResponse.json({
      user: {
        id: userWithPassword.id,
        username: userWithPassword.username,
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
