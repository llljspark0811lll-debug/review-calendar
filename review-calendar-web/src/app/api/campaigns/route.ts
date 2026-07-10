import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findSiteConnectionByDomain, insertCampaign } from "@/lib/db";
import { parseCampaignLink } from "@/lib/parsers";
import type { Campaign } from "@/types/campaign";

export const runtime = "nodejs";

function normalizeDomain(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    throw new Error("올바른 링크 형식이 아니에요.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as {
      url?: string;
      companyPhone?: string;
    };
    const url = body.url?.trim();
    const companyPhone = body.companyPhone?.trim();

    if (!url) {
      return NextResponse.json(
        { message: "선정 상세 링크를 입력해 주세요." },
        { status: 400 },
      );
    }

    if (!companyPhone) {
      return NextResponse.json(
        { message: "업체 연락처를 입력해 주세요." },
        { status: 400 },
      );
    }

    const domain = normalizeDomain(url);
    const siteConnection = await findSiteConnectionByDomain(domain, user.id);

    if (!siteConnection) {
      return NextResponse.json(
        { message: "먼저 사이트 관리에서 해당 체험단 사이트를 등록해 주세요." },
        { status: 400 },
      );
    }

    if (siteConnection.parserStatus !== "supported") {
      return NextResponse.json(
        {
          message:
            "등록된 사이트지만 아직 자동 등록을 지원하지 않아요. 지원 사이트를 순차적으로 확장할 예정이에요.",
        },
        { status: 400 },
      );
    }

    const parsed = await parseCampaignLink(url, user.id);
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
