import { parseDailyviewCampaign, parseDailyviewCampaignHtml } from "@/lib/dailyview/parser";
import type { CampaignParser } from "@/lib/parsers/types";

function getCampaignId(url: URL) {
  return url.searchParams.get("cp_id") ?? "unknown";
}

export const dailyviewParser: CampaignParser = {
  canHandle(url) {
    return url.hostname.replace(/^www\./, "") === "dailyview.kr";
  },
  async parse(url) {
    const campaignId = getCampaignId(url);

    if (!campaignId || campaignId === "unknown") {
      throw new Error("데일리뷰 체험단 상세 링크를 입력해 주세요.");
    }

    return parseDailyviewCampaign(campaignId, url.href);
  },
  parseContent(html) {
    return parseDailyviewCampaignHtml(html, "");
  },
};
