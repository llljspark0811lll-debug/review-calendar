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
  const match = source.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`));
  return decodeXml(match?.[1]?.trim() ?? "");
}

function decodeXml(value: string) {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function assertSuccessfulHolidayResponse(xml: string) {
  const resultCode = getXmlTagValue(xml, "resultCode");
  const resultMsg = getXmlTagValue(xml, "resultMsg");
  const returnReasonCode = getXmlTagValue(xml, "returnReasonCode");
  const returnAuthMsg = getXmlTagValue(xml, "returnAuthMsg");

  if (returnReasonCode || returnAuthMsg) {
    throw new Error(
      `\uacf5\ud734\uc77c API \uc778\uc99d\uc5d0 \uc2e4\ud328\ud588\uc5b4\uc694. ${returnAuthMsg || returnReasonCode}`,
    );
  }

  if (resultCode && resultCode !== "00") {
    throw new Error(
      `\uacf5\ud734\uc77c API\uac00 \uc624\ub958\ub97c \ubc18\ud658\ud588\uc5b4\uc694. ${resultMsg || resultCode}`,
    );
  }
}

function parseHolidayItems(xml: string) {
  const itemBlocks = xml.match(/<item>([\s\S]*?)<\/item>/g) ?? [];

  return itemBlocks
    .map((block) => ({
      locdate: getXmlTagValue(block, "locdate"),
      dateName: getXmlTagValue(block, "dateName"),
      isHoliday: getXmlTagValue(block, "isHoliday"),
    }))
    .filter(
      (item) =>
        /^\d{8}$/.test(item.locdate) &&
        Boolean(item.dateName) &&
        item.isHoliday === "Y",
    );
}

function toIsoDate(compactDate: string) {
  return `${compactDate.slice(0, 4)}-${compactDate.slice(4, 6)}-${compactDate.slice(6, 8)}`;
}

function classifyHoliday(name: string): HolidayType {
  if (name.includes("\ub300\uccb4\uacf5\ud734\uc77c")) {
    return "temporary_holiday";
  }

  if (name.includes("\uc120\uac70")) {
    return "election_day";
  }

  return "public_holiday";
}

function isAlternativeHoliday(name: string) {
  return name.includes("\ub300\uccb4\uacf5\ud734\uc77c");
}

function buildHolidayId(date: string, name: string) {
  return `holiday-${date}-${name.replaceAll(/\s+/g, "-")}`;
}

function toHoliday(item: DataGoKrHolidayItem): Omit<Holiday, "createdAt" | "updatedAt"> {
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
}

export async function fetchOfficialHolidaysByYear(
  year: number,
  serviceKey: string,
) {
  const holidaysById = new Map<string, Omit<Holiday, "createdAt" | "updatedAt">>();

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
      throw new Error(
        `\uacf5\ud734\uc77c API \ud638\ucd9c\uc5d0 \uc2e4\ud328\ud588\uc5b4\uc694. (${response.status})`,
      );
    }

    const xml = await response.text();
    assertSuccessfulHolidayResponse(xml);

    for (const item of parseHolidayItems(xml)) {
      const holiday = toHoliday(item);
      holidaysById.set(holiday.id, holiday);
    }
  }

  return Array.from(holidaysById.values()).sort((left, right) =>
    left.date.localeCompare(right.date) || left.name.localeCompare(right.name),
  );
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

  const syncedYears: number[] = [];
  const skippedYears: number[] = [];

  for (const year of years) {
    if (!forceRefresh && countHolidaysByYear(year) > 0) {
      skippedYears.push(year);
      continue;
    }

    const holidays = await fetchOfficialHolidaysByYear(year, serviceKey);
    upsertHolidays(holidays);
    syncedYears.push(year);
  }

  return { synced: true as const, syncedYears, skippedYears };
}
