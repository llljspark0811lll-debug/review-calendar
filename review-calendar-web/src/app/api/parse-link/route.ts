import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseCampaignLink } from "@/lib/parsers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json(
        { message: "링크가 비어 있어요." },
        { status: 400 },
      );
    }

    const parsed = await parseCampaignLink(body.url, user.id);
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "링크 파싱 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
