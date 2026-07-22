import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { insertCampaign } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Campaign } from "@/types/campaign";

export const runtime = "nodejs";

type CampaignPreviewInput = Omit<Campaign, "id" | "companyPhone" | "contactLocked">;

function isValidPreview(value: unknown): value is CampaignPreviewInput {
  if (!value || typeof value !== "object") {
    return false;
  }

  const preview = value as Record<string, unknown>;

  return (
    typeof preview.title === "string" &&
    preview.title.trim().length > 0 &&
    typeof preview.site === "string" &&
    typeof preview.experienceStartDate === "string" &&
    typeof preview.experienceEndDate === "string" &&
    typeof preview.reviewDeadline === "string"
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as {
      preview?: unknown;
      companyPhone?: string;
    };
    const companyPhone = body.companyPhone?.trim();

    // 붙여넣기 시점(/api/parse-link)에 이미 파싱을 마쳤으므로, 등록 시점에는
    // 같은 내용을 다시 서버에서 파싱하지 않고 그 결과를 그대로 저장한다.
    // (중복 파싱은 특히 링크 자동 fetch 경로에서 불필요한 외부 요청 왕복을 만들어
    // 등록 버튼 클릭이 체감상 느려지는 원인이었다.)
    if (!isValidPreview(body.preview)) {
      return NextResponse.json(
        { message: "선정된 체험단 링크 또는 페이지 내용을 다시 붙여넣어 주세요." },
        { status: 400 },
      );
    }

    if (!companyPhone) {
      return NextResponse.json(
        { message: "업체 연락처를 입력해 주세요." },
        { status: 400 },
      );
    }

    const campaign: Campaign = {
      ...body.preview,
      id: randomUUID(),
      companyPhone,
      contactLocked: false,
      status: "unscheduled",
      selectedDate: null,
    };

    await insertCampaign(campaign, user.id);
    await sendTelegramMessage(
      `📋 체험단 등록\n사용자: ${user.username}\n사이트: ${campaign.site}\n제목: ${campaign.title}`,
    );

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "체험단 등록 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
