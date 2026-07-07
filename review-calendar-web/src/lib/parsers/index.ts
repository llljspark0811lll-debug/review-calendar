import { gangnamParser } from "@/lib/parsers/gangnam";
import { reviewNoteParser } from "@/lib/parsers/review-note";
import type { ParsedCampaign } from "@/lib/parsers/types";

const parsers = [reviewNoteParser, gangnamParser];

function normalizeHostname(hostname: string) {
  return hostname.trim().replace(/^www\./, "");
}

function findParser(url: URL) {
  return parsers.find((item) => item.canHandle(url));
}

export function hasCampaignParserForDomain(domain: string) {
  try {
    const url = new URL(`https://${normalizeHostname(domain)}/`);
    return Boolean(findParser(url));
  } catch {
    return false;
  }
}

export async function parseCampaignLink(
  rawUrl: string,
  userId: string,
): Promise<ParsedCampaign> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("올바른 링크 형식이 아니에요.");
  }

  const parser = findParser(url);

  if (!parser) {
    throw new Error("아직 자동 등록 파서가 준비되지 않은 사이트예요.");
  }

  return parser.parse(url, userId);
}
