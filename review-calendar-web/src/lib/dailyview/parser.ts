import { UserFacingError } from "@/lib/errors";
import type { ParsedCampaign } from "@/lib/parsers/types";

const DAILYVIEW_HOST = "dailyview.kr";
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

function extractMatch(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1];
}

function decodeEntities(input: string) {
  return input
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlToLines(html: string): string[] {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(
      /<\/(div|p|li|tr|td|th|h[1-6]|section|header|footer|label|dt|dd|a|span|b|em)>/gi,
      "\n",
    )
    .replace(/<[^>]+>/g, "");

  return withBreaks
    .split("\n")
    .map((line) => decodeEntities(line))
    .filter(Boolean);
}

function extractValueAfterLabel(
  lines: string[],
  label: string,
  stopLabels: string[],
) {
  const index = lines.findIndex((line) => line === label);

  if (index === -1) {
    return "";
  }

  const collected: string[] = [];

  for (let i = index + 1; i < lines.length; i += 1) {
    const line = lines[i];

    if (stopLabels.includes(line)) {
      break;
    }

    collected.push(line);
  }

  return collected.join(" ").trim();
}

function extractTitle(lines: string[]) {
  return lines.find((line) => /^\[[^\]]+\]\s*\S/.test(line)) ?? "";
}

// 선정 후 로그인 상태로만 볼 수 있는 "마이페이지 > 캠페인 상세" 화면은
// 공개 상세 페이지(review_campaign.php)와 마크업이 완전히 달라서, 캘린더/카드형
// 구조 대신 "업체명/제공내역/주소/체험 및 리뷰기간/방문 및 예약안내" 라벨-값
// 텍스트로 렌더링된다. 이 함수는 그 개인 페이지 전용 경로다.
function parsePersonalDailyviewCampaignHtml(
  html: string,
  href: string,
): ParsedCampaign {
  const lines = htmlToLines(html);
  const companyName = extractValueAfterLabel(lines, "업체명", ["제공내역"]);
  const title = extractTitle(lines) || companyName || "데일리뷰 체험단";
  const reward =
    extractValueAfterLabel(lines, "제공내역", ["주소", "체험 및 리뷰기간"]) ||
    "제공 내역 확인 필요";
  const address = extractValueAfterLabel(lines, "주소", [
    "체험 및 리뷰기간",
  ]).replace(/[\s-]+$/, "");
  const visitInfo = extractValueAfterLabel(lines, "방문 및 예약안내", [
    "키워드",
    "리뷰작성 가이드",
    "참고사항",
  ]);

  const periodMatch = lines
    .join(" ")
    .match(/(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/);

  if (!periodMatch) {
    throw new UserFacingError("데일리뷰 체험단 기간을 확인하지 못했어요.");
  }

  return {
    title,
    site: "데일리뷰",
    reward,
    status: "unscheduled",
    detailUrl: href,
    experienceStartDate: periodMatch[1],
    experienceEndDate: periodMatch[2],
    reviewDeadline: periodMatch[2],
    selectedDate: null,
    capacity: "미정",
    companyName: companyName || title.replace(/^\[[^\]]+\]\s*/, ""),
    companyPhone: null,
    address: address || "주소 확인 필요",
    memo: visitInfo || "방문 및 예약 안내를 확인해 주세요.",
    sticker: "데일리뷰",
    accent: "from-[#8ec9ff] via-[#c7e4ff] to-[#eef7ff]",
    contactLocked: false,
  };
}

function parseReviewPeriod(html: string) {
  const match =
    /<em(?:\s+class="[^"]*")?\s*>\s*리뷰\s*등록기간\s*<\/em>\s*<b[^>]*>\s*(\d{1,2})\.(\d{1,2})\([^)]*\)\s*~\s*(\d{1,2})\.(\d{1,2})\([^)]*\)\s*<\/b>/.exec(
      html,
    );

  if (!match) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const startMonth = Number(match[1]);
  const endMonth = Number(match[3]);
  const endYear = endMonth < startMonth ? currentYear + 1 : currentYear;

  return {
    start: `${currentYear}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`,
    end: `${endYear}-${match[3].padStart(2, "0")}-${match[4].padStart(2, "0")}`,
  };
}

async function fetchDailyviewHtml(campaignId: string) {
  const url = `https://www.${DAILYVIEW_HOST}/review_campaign.php?cp_id=${campaignId}`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const message = error instanceof Error ? ` (${error.message})` : "";
    throw new UserFacingError(`데일리뷰 체험단 정보를 불러오지 못했어요${message}.`);
  }

  if (!response.ok) {
    throw new UserFacingError(
      `데일리뷰 체험단 정보를 불러오지 못했어요 (HTTP ${response.status}).`,
    );
  }

  return response.text();
}

// 공개 상세 페이지(review_campaign.php)는 서버 렌더링된 카드형 마크업을 그대로 쓴다.
function parsePublicDailyviewCampaignHtml(
  html: string,
  href: string,
): ParsedCampaign {
  const title =
    compactText(extractMatch(html, /<div class="itname"[^>]*>([\s\S]*?)<\/div>/i)) ||
    "데일리뷰 체험단";

  const reward =
    compactText(
      extractMatch(
        html,
        /<div class="it_cp_reward_cut"[^>]*>\s*<div class="tit"[^>]*>[^<]*<\/div>\s*<div class="con"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
      ),
    ) || "제공 내역 확인 필요";

  const reviewPeriod = parseReviewPeriod(html);

  if (!reviewPeriod) {
    throw new UserFacingError("데일리뷰 체험단 기간을 확인하지 못했어요.");
  }

  const capacityMatch = html.match(
    /class="item_num"[^>]*>\s*신청\s*<b[^>]*>(\d+)<\/b>\s*\/\s*모집\s*<b[^>]*>(\d+)<\/b>/i,
  );
  const capacity = capacityMatch ? `${capacityMatch[1]}/${capacityMatch[2]}` : "미정";

  return {
    title,
    site: "데일리뷰",
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
    address: "주소 확인 필요",
    memo: "방문 가능 요일/시간은 데일리뷰 페이지에서 확인해 주세요.",
    sticker: "데일리뷰",
    accent: "from-[#8ec9ff] via-[#c7e4ff] to-[#eef7ff]",
    contactLocked: false,
  };
}

export function parseDailyviewCampaignHtml(
  html: string,
  href: string,
): ParsedCampaign {
  const isPublicDetailPage = /<div class="itname"/i.test(html);

  return isPublicDetailPage
    ? parsePublicDailyviewCampaignHtml(html, href)
    : parsePersonalDailyviewCampaignHtml(html, href);
}

export async function parseDailyviewCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const html = await fetchDailyviewHtml(campaignId);
  return parseDailyviewCampaignHtml(html, href);
}
