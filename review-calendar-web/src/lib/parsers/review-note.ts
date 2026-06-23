import { parseReviewNoteCampaign } from "@/lib/review-note/parser";
import type { CampaignParser } from "@/lib/parsers/types";

function getCampaignId(url: URL) {
  const match = url.pathname.match(/\/campaigns\/(\d+)/);
  return match?.[1] ?? "unknown";
}

export const reviewNoteParser: CampaignParser = {
  canHandle(url) {
    return url.hostname.includes("reviewnote.co.kr");
  },
  async parse(url) {
    const campaignId = getCampaignId(url);
    return parseReviewNoteCampaign(campaignId, url.href);
  },
};
