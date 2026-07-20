import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { completeUserOnboarding } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    await completeUserOnboarding(currentUser.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "가이드 완료 처리 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
