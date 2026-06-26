import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  deleteSiteConnection,
  findSiteConnectionById,
  findSiteConnectionByDomain,
  insertSiteConnection,
  listSiteConnections,
} from "@/lib/db";
import { clearGangnamSession } from "@/lib/gangnam/session";
import { clearReviewNoteSession } from "@/lib/review-note/session";
import type { ParserSupport, SiteConnection } from "@/types/site-connection";

export const runtime = "nodejs";

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
  return domain === "reviewnote.co.kr" || domain === "xn--939au0g4vj8sq.net"
    ? "supported"
    : "unsupported";
}

export async function GET() {
  return NextResponse.json({
    siteConnections: listSiteConnections(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      siteName?: string;
      baseUrl?: string;
      loginUrl?: string;
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
    const normalizedLoginUrl = body.loginUrl?.trim()
      ? parseDomain(body.loginUrl).normalized
      : normalizedBaseUrl;

    if (findSiteConnectionByDomain(domain)) {
      return NextResponse.json(
        { message: "이미 등록된 사이트예요." },
        { status: 400 },
      );
    }

    const siteConnection: SiteConnection = {
      id: randomUUID(),
      siteName: body.siteName.trim(),
      baseUrl: normalizedBaseUrl,
      loginUrl: normalizedLoginUrl,
      domain,
      parserStatus: detectParserSupport(domain),
      createdAt: new Date().toISOString(),
    };

    insertSiteConnection(siteConnection);

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
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json(
      { message: "삭제할 사이트 정보가 없어요." },
      { status: 400 },
    );
  }

  const site = findSiteConnectionById(id);

  if (site?.domain === "reviewnote.co.kr") {
    await clearReviewNoteSession();
  }

  if (site?.domain === "xn--939au0g4vj8sq.net") {
    await clearGangnamSession();
  }

  deleteSiteConnection(id);
  return NextResponse.json({ ok: true });
}
