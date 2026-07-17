import { UserFacingError } from "@/lib/errors";
import type { ParsedCampaign } from "@/lib/parsers/types";

const GANGNAM_HOST = "xn--939au0g4vj8sq.net";
const REQUEST_TIMEOUT_MS = 25000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";

function compactText(input: string | undefined | null) {
  return (
    input
      ?.replace(/<br\s*\/?>/gi, "\n")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, "\"")
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function decodeHtmlAttribute(input: string | undefined | null) {
  return compactText(input);
}

// compactText와 달리 줄바꿈(<br>, </p>, </li>)은 \n으로 보존한다.
// 가이드라인/주의사항처럼 번호 목록·문단 구분이 의미 있는 안내문에 쓴다.
function compactMultilineText(input: string | undefined | null) {
  return (
    input
      ?.replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br[^>]*>/gi, "\n")
      .replace(/<\/(p|div|li)>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&gt;/g, ">")
      .replace(/&lt;/g, "<")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, "\"")
      .split("\n")
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

function extractMatch(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1];
}

function extractDetailValue(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return compactText(
    extractMatch(
      html,
      new RegExp(
        `<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>[\\s\\S]*?<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
        "i",
      ),
    ),
  );
}

function extractDetailValueMultiline(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return compactMultilineText(
    extractMatch(
      html,
      new RegExp(
        `<dt[^>]*>\\s*${escapedLabel}\\s*<\\/dt>[\\s\\S]*?<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
        "i",
      ),
    ),
  );
}

function parseDateRange(value: string) {
  const match = value.match(
    /(\d{1,2})\.(\d{1,2})\s*~\s*(\d{1,2})\.(\d{1,2})/,
  );

  if (!match) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const startMonth = Number(match[1]);
  const startDay = Number(match[2]);
  const endMonth = Number(match[3]);
  const endDay = Number(match[4]);
  const endYear = endMonth < startMonth ? currentYear + 1 : currentYear;

  return {
    start: `${currentYear}-${`${startMonth}`.padStart(2, "0")}-${`${startDay}`.padStart(2, "0")}`,
    end: `${endYear}-${`${endMonth}`.padStart(2, "0")}-${`${endDay}`.padStart(2, "0")}`,
  };
}

function extractAddress(html: string, visitInfo: string) {
  const candidates = [
    compactText(extractMatch(html, /<meta property=['"]og:street-address['"] content=['"]([^'"]+)['"]/i)),
    compactText(extractMatch(html, /<meta name=['"]twitter:data1['"] content=['"]([^'"]+)['"]/i)),
    visitInfo,
    extractDetailValue(html, "지역"),
    compactText(html),
  ].filter(Boolean);
  const addressPattern =
    /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]*?(?:\d{1,5}(?:-\d{1,5})?))/;

  for (const candidate of candidates) {
    const address = candidate.match(addressPattern)?.[1]?.trim();

    if (address) {
      return address;
    }
  }

  return "";
}

async function requestHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchGangnamHtml(campaignId: string) {
  const urls = [
    `https://${GANGNAM_HOST}/cp/?id=${campaignId}`,
    `http://${GANGNAM_HOST}/cp/?id=${campaignId}`,
  ];
  let lastError: unknown;

  for (const url of urls) {
    try {
      return await requestHtml(url);
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? ` (${lastError.message})` : "";
  throw new UserFacingError(`강남맛집 체험단 정보를 불러오지 못했어요${message}.`);
}

export function parseGangnamCampaignHtml(
  html: string,
  href: string,
): ParsedCampaign {
  const title =
    compactText(extractMatch(html, /<p class="tit"[^>]*>\s*([\s\S]*?)\s*<\/p>/i)) ||
    decodeHtmlAttribute(
      extractMatch(html, /<meta property=['"]og:title['"] content=['"]([^'"]+)['"]/i),
    ) ||
    "강남맛집 체험단";
  const reward =
    extractDetailValue(html, "제공내역") ||
    compactText(extractMatch(html, /<p class="sub_tit"[^>]*>([\s\S]*?)<\/p>/i)) ||
    decodeHtmlAttribute(
      extractMatch(
        html,
        /<meta property=['"]og:description['"] content=['"]([^'"]+)['"]/i,
      ),
    ) ||
    "제공 내역 확인 필요";
  const reviewPeriod = parseDateRange(extractDetailValue(html, "리뷰 등록기간"));

  if (!reviewPeriod) {
    throw new UserFacingError("강남맛집 체험단 기간을 확인하지 못했어요.");
  }

  const visitInfo = extractDetailValue(html, "방문 및 예약");
  const address = extractAddress(html, visitInfo);
  const capacityMatch = html.match(
    /<em[^>]*id=["']ask_count["'][^>]*>\s*(\d+)\s*<\/em>\s*\/\s*(\d+)/i,
  );
  const capacity = capacityMatch ? `${capacityMatch[1]}/${capacityMatch[2]}` : "미정";

  // 로그인 후 "선정된 캠페인" 개인 페이지는 방문/예약 안내 대신 가이드라인·키워드로
  // 미션과 필수 키워드를 안내한다("리뷰 시 주의사항"은 모든 캠페인에 공통으로 붙는
  // 상투적 문구라 제외한다). 공개 상세 페이지에는 이 라벨이 없으므로 그 경우엔
  // 방문/예약 안내로 자연히 대체된다.
  const guideline = extractDetailValueMultiline(html, "가이드라인");
  const keywords = extractDetailValueMultiline(html, "키워드")
    .split("\n")
    .filter((line) => line !== "복사")
    .join(" ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" | ");
  const guideMemo = [guideline, keywords && `키워드\n${keywords}`]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    site: "강남맛집",
    reward,
    status: "unscheduled",
    detailUrl: href,
    experienceStartDate: reviewPeriod.start,
    experienceEndDate: reviewPeriod.end,
    reviewDeadline: reviewPeriod.end,
    selectedDate: null,
    capacity,
    companyName: title.replace(/^\[[^\]]+\]\s*/, ""),
    companyPhone: null,
    address: address || "주소 확인 필요",
    memo: guideMemo || visitInfo || "방문 및 예약 안내를 확인해 주세요.",
    sticker: "강남맛집",
    accent: "from-[#ffb86b] via-[#ffd6a8] to-[#fff2df]",
    contactLocked: false,
  };
}

export async function parseGangnamCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const html = await fetchGangnamHtml(campaignId);
  return parseGangnamCampaignHtml(html, href);
}
