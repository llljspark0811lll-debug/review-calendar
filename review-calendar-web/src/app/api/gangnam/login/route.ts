import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { launchGangnamLogin } from "@/lib/gangnam/session";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const result = await launchGangnamLogin(user.id);
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
