export type HolidayType =
  | "public_holiday"
  | "temporary_holiday"
  | "election_day"
  | "observance";

export type Holiday = {
  id: string;
  date: string;
  name: string;
  type: HolidayType;
  isAlternative: boolean;
  isPublicHoliday: boolean;
  source: string;
  sourceUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

