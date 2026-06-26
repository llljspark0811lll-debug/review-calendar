import { NextResponse } from "next/server";
import { launchGangnamLogin } from "@/lib/gangnam/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await launchGangnamLogin();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "강남맛집 로그인 연동 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
