import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
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
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json(
        { message: "링크가 비어 있어요." },
        { status: 400 },
      );
    }

    const domain = normalizeDomain(body.url);
    const siteConnection = findSiteConnectionByDomain(domain);

    if (!siteConnection) {
      return NextResponse.json(
        {
          message:
            "먼저 사이트 연동에서 해당 체험단 사이트를 등록하고 로그인 연동을 완료해 주세요.",
        },
        { status: 400 },
      );
    }

    if (siteConnection.parserStatus !== "supported") {
      return NextResponse.json(
        {
          message:
            "등록된 사이트지만 아직 자동 등록을 지원하지 않아요. 지원 사이트부터 순차적으로 확장할 예정이에요.",
        },
        { status: 400 },
      );
    }

    const parsed = await parseCampaignLink(body.url);
    const campaign: Campaign = {
      ...parsed,
      id: randomUUID(),
    };

    insertCampaign(campaign);

    return NextResponse.json(campaign);
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
