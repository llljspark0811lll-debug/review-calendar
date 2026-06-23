export type CampaignStatus =
  | "unscheduled"
  | "scheduled"
  | "completed"
  | "review_submitted";

export type Campaign = {
  id: string;
  title: string;
  site: string;
  reward: string;
  status: CampaignStatus;
  detailUrl: string;
  experienceStartDate: string;
  experienceEndDate: string;
  reviewDeadline: string;
  selectedDate: string | null;
  capacity: string;
  companyName: string;
  companyPhone: string | null;
  address: string;
  memo: string;
  sticker: string;
  accent: string;
  contactLocked: boolean;
};
