import { NextResponse } from "next/server";
import { launchReviewNoteLogin } from "@/lib/review-note/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await launchReviewNoteLogin();
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
