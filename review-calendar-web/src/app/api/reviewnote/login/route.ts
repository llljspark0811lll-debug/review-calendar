import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { launchReviewNoteLogin } from "@/lib/review-note/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const result = await launchReviewNoteLogin(user.id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "리뷰노트 로그인 연동 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
