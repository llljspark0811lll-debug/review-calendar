import type { Holiday, HolidayType } from "@/types/holiday";
import { countHolidaysByYear, upsertHolidays } from "@/lib/db";

const HOLIDAY_SERVICE_URL =
  "https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo";

type DataGoKrHolidayItem = {
  locdate: string;
  dateName: string;
  isHoliday: string;
};

function getXmlTagValue(source: string, tagName: string) {
  const match = source.match(new RegExp(`<${tagName}>(.*?)</${tagName}>`));
  return match?.[1]?.trim() ?? "";
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function parseHolidayItems(xml: string) {
  const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

  return itemBlocks
    .map((block) => ({
      locdate: getXmlTagValue(block, "locdate"),
      dateName: decodeXml(getXmlTagValue(block, "dateName")),
      isHoliday: getXmlTagValue(block, "isHoliday"),
    }))
    .filter((item) => item.locdate && item.dateName);
}

function toIsoDate(compactDate: string) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function classifyHoliday(name: string): HolidayType {
  if (name.includes("대체공휴일")) {
    return "temporary_holiday";
  }

  if (name.includes("선거")) {
    return "election_day";
  }

  return "public_holiday";
}

function isAlternativeHoliday(name: string) {
  return name.includes("대체공휴일");
}

function buildHolidayId(date: string, name: string) {
  return `holiday-${date}-${name.replaceAll(/\s+/g, "-")}`;
}

export async function fetchOfficialHolidaysByYear(
  year: number,
  serviceKey: string,
) {
  const items: DataGoKrHolidayItem[] = [];

  for (let month = 1; month <= 12; month += 1) {
    const url = new URL(HOLIDAY_SERVICE_URL);
    url.searchParams.set("serviceKey", serviceKey);
    url.searchParams.set("solYear", `${year}`);
    url.searchParams.set("solMonth", `${month}`.padStart(2, "0"));
    url.searchParams.set("numOfRows", "100");
    url.searchParams.set("pageNo", "1");

    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 12 },
    });

    if (!response.ok) {
      throw new Error(`공휴일 API 호출에 실패했어요. (${response.status})`);
    }

    const xml = await response.text();
    items.push(...parseHolidayItems(xml));
  }

  return items
    .filter((item) => item.isHoliday === "Y")
    .map((item): Omit<Holiday, "createdAt" | "updatedAt"> => {
      const date = toIsoDate(item.locdate);
      return {
        id: buildHolidayId(date, item.dateName),
        date,
        name: item.dateName,
        type: classifyHoliday(item.dateName),
        isAlternative: isAlternativeHoliday(item.dateName),
        isPublicHoliday: true,
        source: "data_go_kr",
        sourceUpdatedAt: new Date().toISOString(),
      };
    });
}

export async function ensureHolidayCoverageForYears(years: number[]) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;

  return ensureHolidayCoverage(years, serviceKey, false);
}

export async function refreshHolidayCoverageForYears(years: number[]) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;

  return ensureHolidayCoverage(years, serviceKey, true);
}

async function ensureHolidayCoverage(
  years: number[],
  serviceKey: string | undefined,
  forceRefresh: boolean,
) {
  if (!serviceKey) {
    return { synced: false, reason: "missing-service-key" as const };
  }

  for (const year of years) {
    if (!forceRefresh && countHolidaysByYear(year) > 0) {
      continue;
    }

    const holidays = await fetchOfficialHolidaysByYear(year, serviceKey);
    upsertHolidays(holidays);
  }

  return { synced: true as const };
}
