import { NextResponse } from "next/server";
import {
  getCurrentUser,
  isValidEmail,
  normalizeEmail,
  verifyEmailCode,
  verifyPassword,
} from "@/lib/auth";
import { findUserByEmail, findUserById, updateUserEmail } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as {
      email?: string;
      currentPassword?: string;
      emailCode?: string;
    };
    const email = normalizeEmail(body.email ?? "");
    const currentPassword = body.currentPassword ?? "";
    const emailCode = body.emailCode?.trim() ?? "";

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { message: "이메일 주소를 올바르게 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!currentPassword) {
      return NextResponse.json(
        { message: "현재 비밀번호를 입력해 주세요." },
        { status: 400 },
      );
    }

    const userRow = await findUserById(currentUser.id);

    if (!userRow || !(await verifyPassword(currentPassword, userRow.passwordHash))) {
      return NextResponse.json(
        { message: "현재 비밀번호가 올바르지 않아요." },
        { status: 401 },
      );
    }

    if (email === userRow.email) {
      return NextResponse.json(
        { message: "현재 이메일과 같아요." },
        { status: 400 },
      );
    }

    const existing = await findUserByEmail(email);

    if (existing && existing.id !== currentUser.id) {
      return NextResponse.json(
        { message: "이미 사용 중인 이메일이에요." },
        { status: 400 },
      );
    }

    if (!emailCode || !(await verifyEmailCode(email, emailCode))) {
      return NextResponse.json(
        { message: "이메일 인증번호를 확인해 주세요." },
        { status: 400 },
      );
    }

    await updateUserEmail(currentUser.id, email);

    return NextResponse.json({ ok: true, email });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "이메일 변경 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
