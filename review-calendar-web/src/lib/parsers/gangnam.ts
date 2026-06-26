import { parseGangnamCampaign } from "@/lib/gangnam/parser";
import type { CampaignParser } from "@/lib/parsers/types";

function getCampaignId(url: URL) {
  return url.searchParams.get("id") ?? "unknown";
}

export const gangnamParser: CampaignParser = {
  canHandle(url) {
    return url.hostname.replace(/^www\./, "") === "xn--939au0g4vj8sq.net";
  },
  async parse(url) {
    const campaignId = getCampaignId(url);

    if (!campaignId || campaignId === "unknown") {
      throw new Error("강남맛집 체험단 상세 링크를 입력해 주세요.");
    }

    return parseGangnamCampaign(campaignId, url.href);
  },
};
