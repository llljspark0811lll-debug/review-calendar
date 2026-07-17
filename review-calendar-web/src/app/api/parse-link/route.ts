import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toClientMessage } from "@/lib/errors";
import { parseCampaignContent } from "@/lib/parsers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as { content?: string };

    if (!body.content?.trim()) {
      return NextResponse.json(
        { message: "체험단 페이지 내용을 붙여넣어 주세요." },
        { status: 400 },
      );
    }

    const parsed = await parseCampaignContent(body.content, user.id);
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "링크 파싱 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
