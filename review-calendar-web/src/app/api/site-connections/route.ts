import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  deleteSiteConnection,
  findSiteConnectionByDomain,
  insertSiteConnection,
  listSiteConnections,
} from "@/lib/db";
import { hasCampaignParserForDomain } from "@/lib/parsers";
import type { ParserSupport, SiteConnection } from "@/types/site-connection";

export const runtime = "nodejs";

async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      response: NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 }),
      user: null,
    };
  }

  return { response: null, user };
}

function normalizeUrl(rawValue: string) {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    throw new Error("사이트 주소를 입력해 주세요.");
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseDomain(rawValue: string) {
  try {
    const normalized = normalizeUrl(rawValue);
    const url = new URL(normalized);
    return {
      normalized,
      domain: url.hostname.replace(/^www\./, ""),
    };
  } catch {
    throw new Error("올바른 사이트 주소를 입력해 주세요.");
  }
}

function detectParserSupport(domain: string): ParserSupport {
  return hasCampaignParserForDomain(domain) ? "supported" : "unsupported";
}

export async function GET() {
  const { response, user } = await requireUser();

  if (response) {
    return response;
  }

  return NextResponse.json({
    siteConnections: await listSiteConnections(user.id),
  });
}

export async function POST(request: Request) {
  try {
    const { response, user } = await requireUser();

    if (response) {
      return response;
    }

    const body = (await request.json()) as {
      siteName?: string;
      baseUrl?: string;
    };

    if (!body.siteName?.trim()) {
      return NextResponse.json(
        { message: "사이트 이름을 입력해 주세요." },
        { status: 400 },
      );
    }

    const { normalized: normalizedBaseUrl, domain } = parseDomain(
      body.baseUrl ?? "",
    );
    if (await findSiteConnectionByDomain(domain, user.id)) {
      return NextResponse.json(
        { message: "이미 등록된 사이트예요." },
        { status: 400 },
      );
    }

    const siteConnection: SiteConnection = {
      id: randomUUID(),
      siteName: body.siteName.trim(),
      baseUrl: normalizedBaseUrl,
      loginUrl: normalizedBaseUrl,
      domain,
      parserStatus: detectParserSupport(domain),
      createdAt: new Date().toISOString(),
    };

    await insertSiteConnection(siteConnection, user.id);

    return NextResponse.json(siteConnection);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "사이트 추가 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const { response, user } = await requireUser();

  if (response) {
    return response;
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "삭제할 사이트 정보가 없어요." },
      { status: 400 },
    );
  }

  await deleteSiteConnection(id, user.id);
  return NextResponse.json({ ok: true });
}
