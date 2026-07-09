import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { launchGangnamLogin } from "@/lib/gangnam/session";

export const runtime = "nodejs";

const vercelLoginMessage =
  "배포 환경에서는 체험단 사이트 로그인 창을 직접 띄울 수 없어요. 자동 로그인 연동은 별도 자동화 서버를 연결한 뒤 사용할 수 있어요.";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    if (process.env.VERCEL === "1") {
      return NextResponse.json({ message: vercelLoginMessage }, { status: 501 });
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
