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
] as const;

function normalizeHostname(hostname: string) {
  return hostname.trim().replace(/^www\./, "");
}

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

  const { gangnamParser } = await import("@/lib/parsers/gangnam");
  return gangnamParser;
}

export function hasCampaignParserForDomain(domain: string) {
  try {
    const url = new URL(`https://${normalizeHostname(domain)}/`);
    return Boolean(findParserMatcher(url));
  } catch {
    return false;
  }
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
    throw new Error("올바른 링크 형식이 아니에요.");
  }

  const parserMatcher = findParserMatcher(url);

  if (!parserMatcher) {
    throw new Error("아직 자동 등록 파서가 준비되지 않은 사이트예요.");
  }

  const parser = await loadParser(parserMatcher.id);
  return parser.parse(url);
}
