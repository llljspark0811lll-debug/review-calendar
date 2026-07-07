import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findSiteConnectionByDomain, insertAutomationJob } from "@/lib/db";

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

    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json(
        { message: "링크가 비어 있어요." },
        { status: 400 },
      );
    }

    const domain = normalizeDomain(body.url);
    const siteConnection = await findSiteConnectionByDomain(domain, user.id);

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
            "등록된 사이트지만 아직 자동 등록을 지원하지 않아요. 지원 사이트를 순차적으로 확장할 예정이에요.",
        },
        { status: 400 },
      );
    }

    const job = await insertAutomationJob({
      id: randomUUID(),
      userId: user.id,
      type: "parse_campaign",
      input: {
        url: body.url,
      },
    });

    return NextResponse.json({ job }, { status: 202 });
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
