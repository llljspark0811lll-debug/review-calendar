import { parseKeyplatCampaign, parseKeyplatCampaignHtml } from "@/lib/keyplat/parser";
import type { CampaignParser } from "@/lib/parsers/types";

export const keyplatParser: CampaignParser = {
  canHandle(url) {
    return url.hostname.replace(/^www\./, "") === "keyplat.net";
  },
  async parse() {
    return parseKeyplatCampaign();
  },
  parseContent(html) {
    return parseKeyplatCampaignHtml(html, "");
  },
};
