import type { Campaign } from "@/types/campaign";

export type ParsedCampaign = Omit<Campaign, "id">;

export interface CampaignParser {
  canHandle(url: URL): boolean;
  parse(url: URL): Promise<ParsedCampaign>;
}
