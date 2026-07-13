import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { insertCampaign } from "@/lib/db";
import { parseCampaignContent } from "@/lib/parsers";
import type { Campaign } from "@/types/campaign";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as {
      content?: string;
      companyPhone?: string;
    };
    const content = body.content?.trim();
    const companyPhone = body.companyPhone?.trim();

    if (!content) {
      return NextResponse.json(
        { message: "선정된 체험단 링크 또는 페이지 내용을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!companyPhone) {
      return NextResponse.json(
        { message: "업체 연락처를 입력해 주세요." },
        { status: 400 },
      );
    }

    const parsed = await parseCampaignContent(content, user.id);
    const campaign: Campaign = {
      ...parsed,
      id: randomUUID(),
      companyPhone,
      contactLocked: false,
    };

    await insertCampaign(campaign, user.id);

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "체험단 등록 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
