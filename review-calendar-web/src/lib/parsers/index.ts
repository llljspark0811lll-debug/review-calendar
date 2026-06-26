import { gangnamParser } from "@/lib/parsers/gangnam";
import { reviewNoteParser } from "@/lib/parsers/review-note";
import type { ParsedCampaign } from "@/lib/parsers/types";

const parsers = [reviewNoteParser, gangnamParser];

export async function parseCampaignLink(rawUrl: string): Promise<ParsedCampaign> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("올바른 링크 형식이 아니에요.");
  }

  const parser = parsers.find((item) => item.canHandle(url));

  if (!parser) {
    throw new Error("아직 지원하지 않는 사이트예요.");
  }

  return parser.parse(url);
}
