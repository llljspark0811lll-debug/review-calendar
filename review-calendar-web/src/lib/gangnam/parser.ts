import { getGangnamCookieHeader } from "@/lib/gangnam/session";
import type { ParsedCampaign } from "@/lib/parsers/types";

const GANGNAM_HOST = "xn--939au0g4vj8sq.net";

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
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

function decodeHtmlAttribute(input: string | undefined | null) {
  return compactText(input?.replace(/&#39;/g, "'").replace(/&quot;/g, "\""));
}

function extractMatch(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1];
}

function extractDetailValue(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return compactText(
    extractMatch(
      html,
      new RegExp(`<dt>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, "i"),
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

function extractPhone(html: string) {
  const withoutFooter = html.split(/<footer|<div class="foot_/i)[0] ?? html;
  const phones = withoutFooter.match(
    /(?:0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}|1[5-9]\d{2}[-.\s]?\d{4})/g,
  );

  return (
    phones
      ?.map((phone) => phone.replace(/[.\s]+/g, "-"))
      .find((phone) => !phone.startsWith("1688-2352")) ?? null
  );
}

function extractAddress(visitInfo: string) {
  const addressMatch = visitInfo.match(
    /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]*?(?:\d|층|호)[^\n]*)/,
  );

  return addressMatch?.[1]?.trim() ?? "";
}

export async function parseGangnamCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const cookieHeader = await getGangnamCookieHeader();

  if (!cookieHeader) {
    throw new Error("강남맛집 로그인이 먼저 필요해요.");
  }

  // 강남맛집 서버는 일부 Node 인증서 체인에서 검증이 실패한다.
  // 이 파서 호출에 필요한 요청 직전에만 환경값을 보정한다.
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const response = await fetch(`https://${GANGNAM_HOST}/cp/?id=${campaignId}`, {
    headers: {
      cookie: cookieHeader,
      accept: "text/html,application/xhtml+xml",
      "user-agent": "ReviewCalendar/1.0",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("강남맛집 체험단 정보를 불러오지 못했어요.");
  }

  const html = await response.text();
  const isLoggedIn =
    /var\s+g5_is_member\s*=\s*"[^\"]+"/.test(html) ||
    !html.includes("/bbs/login.php");

  if (!isLoggedIn) {
    throw new Error("강남맛집 로그인 세션이 만료됐어요. 다시 로그인해 주세요.");
  }

  const phone = extractPhone(html);

  if (!phone) {
    throw new Error(
      "선정된 강남맛집 체험단만 등록할 수 있어요. 업체 연락처가 보이는 선정 상세 링크인지 확인해 주세요.",
    );
  }

  const title =
    compactText(extractMatch(html, /<p class="tit">\s*([\s\S]*?)\s*<\/p>/i)) ||
    decodeHtmlAttribute(
      extractMatch(html, /<meta property='og:title' content='([^']+)'/i),
    ) ||
    `강남맛집 체험단 #${campaignId}`;
  const reward =
    compactText(extractMatch(html, /<p class="sub_tit">([\s\S]*?)<\/p>/i)) ||
    decodeHtmlAttribute(
      extractMatch(html, /<meta property='og:description' content='([^']+)'/i),
    ) ||
    "제공 내역 확인 필요";
  const reviewPeriod = parseDateRange(extractDetailValue(html, "리뷰 등록기간"));

  if (!reviewPeriod) {
    throw new Error("강남맛집 체험 기간을 확인하지 못했어요.");
  }

  const visitInfo = extractDetailValue(html, "방문 및 예약");
  const address = extractAddress(visitInfo);
  const capacityMatch = html.match(
    /신청자\s*<em[^>]*id="ask_count"[^>]*>\s*(\d+)\s*<\/em>\s*\/\s*(\d+)/i,
  );
  const capacity = capacityMatch ? `${capacityMatch[1]}/${capacityMatch[2]}` : "미정";

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
    companyPhone: phone,
    address: address || "주소 정보 확인 필요",
    memo: visitInfo || "방문 및 예약 안내를 확인해 주세요.",
    sticker: "강남맛집 스파클",
    accent: "from-[#ffb86b] via-[#ffd6a8] to-[#fff2df]",
    contactLocked: false,
  };
}
