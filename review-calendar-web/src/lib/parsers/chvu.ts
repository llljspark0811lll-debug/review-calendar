import { parseChvuCampaign, parseChvuCampaignHtml } from "@/lib/chvu/parser";
import type { CampaignParser } from "@/lib/parsers/types";

function getCampaignId(url: URL) {
  const match = url.pathname.match(/\/campaign\/(\d+)/);
  return match?.[1] ?? "unknown";
}

export const chvuParser: CampaignParser = {
  canHandle(url) {
    return url.hostname.replace(/^www\./, "") === "chvu.co.kr";
  },
  async parse(url) {
    const campaignId = getCampaignId(url);
    return parseChvuCampaign(campaignId, url.href);
  },
  parseContent(html) {
    return parseChvuCampaignHtml(html, "");
  },
};
