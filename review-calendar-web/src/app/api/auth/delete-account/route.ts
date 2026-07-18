import { NextResponse } from "next/server";
import { clearSession, getCurrentUser, verifyPassword } from "@/lib/auth";
import { deleteUser, findUserById } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as { currentPassword?: string };
    const currentPassword = body.currentPassword ?? "";

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

    await deleteUser(currentUser.id);
    await clearSession();

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "계정 탈퇴 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
