import { UserFacingError } from "@/lib/errors";
import type { CampaignParser, ParsedCampaign } from "@/lib/parsers/types";

const parserMatchers = [
  {
    id: "reviewnote",
    canHandle(url: URL) {
      return url.hostname.includes("reviewnote.co.kr");
    },
  },
  {
    id: "gangnam",
    canHandle(url: URL) {
      return url.hostname.replace(/^www\./, "") === "xn--939au0g4vj8sq.net";
    },
  },
  {
    id: "dailyview",
    canHandle(url: URL) {
      return url.hostname.replace(/^www\./, "") === "dailyview.kr";
    },
  },
  {
    id: "chvu",
    canHandle(url: URL) {
      return url.hostname.replace(/^www\./, "") === "chvu.co.kr";
    },
  },
] as const;

function findParserMatcher(url: URL) {
  return parserMatchers.find((item) => item.canHandle(url));
}

async function loadParser(
  parserId: (typeof parserMatchers)[number]["id"],
): Promise<CampaignParser> {
  if (parserId === "reviewnote") {
    const { reviewNoteParser } = await import("@/lib/parsers/review-note");
    return reviewNoteParser;
  }

  if (parserId === "dailyview") {
    const { dailyviewParser } = await import("@/lib/parsers/dailyview");
    return dailyviewParser;
  }

  if (parserId === "chvu") {
    const { chvuParser } = await import("@/lib/parsers/chvu");
    return chvuParser;
  }

  const { gangnamParser } = await import("@/lib/parsers/gangnam");
  return gangnamParser;
}

export async function parseCampaignLink(
  rawUrl: string,
  userId: string,
): Promise<ParsedCampaign> {
  void userId;
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new UserFacingError("올바른 링크 형식이 아니에요.");
  }

  const parserMatcher = findParserMatcher(url);

  if (!parserMatcher) {
    throw new UserFacingError("아직 지원하지 않는 체험단 사이트예요.");
  }

  const parser = await loadParser(parserMatcher.id);
  return parser.parse(url);
}

const contentSiteSignatures = [
  { id: "reviewnote", pattern: /reviewnote\.co\.kr|리뷰노트/i },
  { id: "dailyview", pattern: /dailyview\.kr|데일리뷰/i },
  { id: "gangnam", pattern: /xn--939au0g4vj8sq\.net|강남맛집/i },
  { id: "chvu", pattern: /chvu\.co\.kr|체험뷰/i },
] as const;

function detectParserIdFromContent(content: string) {
  return contentSiteSignatures.find((signature) => signature.pattern.test(content))?.id ?? null;
}

function looksLikeBareUrl(value: string) {
  return /^https?:\/\/\S+$/.test(value) && !/[\n\r]/.test(value);
}

export async function parseCampaignContent(
  rawContent: string,
  userId: string,
): Promise<ParsedCampaign> {
  const trimmed = rawContent.trim();

  if (!trimmed) {
    throw new UserFacingError("붙여넣은 내용이 비어 있어요.");
  }

  if (looksLikeBareUrl(trimmed)) {
    return parseCampaignLink(trimmed, userId);
  }

  const parserId = detectParserIdFromContent(trimmed);

  if (!parserId) {
    throw new UserFacingError(
      "지원하는 체험단 사이트 페이지를 찾지 못했어요. 선정된 체험단 상세 페이지에서 전체 복사(Ctrl+A → Ctrl+C)해서 다시 붙여넣어 주세요.",
    );
  }

  const parser = await loadParser(parserId);
  return parser.parseContent(trimmed);
}
