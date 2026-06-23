import { getReviewNoteCookieHeader } from "@/lib/review-note/session";
import type { ParsedCampaign } from "@/lib/parsers/types";

type ReviewNoteCampaignResponse = {
  id: number;
  title?: string;
  offer?: string;
  applyStartAt?: string;
  applyEndAt?: string;
  reviewEndAt?: string;
  extendedReviewEndAt?: string | null;
  contact?: string | null;
  address1?: string | null;
  address2?: string | null;
  url?: string | null;
  sort?: string | null;
  infPoint?: number | null;
  city?: string | null;
  category?: {
    title?: string | null;
  } | null;
  user?: {
    companyName?: string | null;
  } | null;
};

function formatDateString(input: string | undefined | null, dayOffset = 0) {
  if (!input) {
    return "2026-06-03";
  }

  const date = new Date(input);
  date.setDate(date.getDate() + dayOffset);

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function compactText(input: string | undefined | null) {
  return input?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeOffer(data: ReviewNoteCampaignResponse) {
  const offer = compactText(data.offer);

  if (offer) {
    return offer;
  }

  if (data.infPoint) {
    return `${data.infPoint.toLocaleString("ko-KR")}P`;
  }

  return "제공 내역 확인 필요";
}

function buildAddress(data: ReviewNoteCampaignResponse) {
  return [compactText(data.address1), compactText(data.address2)]
    .filter(Boolean)
    .join(" ");
}

function buildMemo(data: ReviewNoteCampaignResponse) {
  const parts = [
    data.sort ? `유형: ${data.sort}` : "",
    data.city ? `지역: ${data.city}` : "",
    data.category?.title ? `카테고리: ${data.category.title}` : "",
    data.contact ? "담당자 연락처 파싱 완료" : "담당자 연락처가 없거나 로그인 범위 밖일 수 있음",
  ].filter(Boolean);

  return parts.join(" / ");
}

export async function parseReviewNoteCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const cookieHeader = await getReviewNoteCookieHeader();

  if (!cookieHeader) {
    throw new Error("리뷰노트 로그인이 먼저 필요해요.");
  }

  const response = await fetch(
    `https://www.reviewnote.co.kr/api/campaign?id=${campaignId}`,
    {
      headers: {
        cookie: cookieHeader,
        accept: "application/json, text/plain, */*",
        "user-agent": "ReviewCalendar/1.0",
      },
      cache: "no-store",
    },
  );

  if (response.status === 401) {
    throw new Error("리뷰노트 로그인 세션이 만료됐어요. 다시 로그인해 주세요.");
  }

  if (!response.ok) {
    throw new Error("리뷰노트 체험단 정보를 불러오지 못했어요.");
  }

  const data = (await response.json()) as ReviewNoteCampaignResponse;
  const experienceStartDate = formatDateString(data.applyEndAt, 1);
  const reviewDeadline = formatDateString(
    data.extendedReviewEndAt ?? data.reviewEndAt,
  );
  const experienceEndDate = formatDateString(data.reviewEndAt);
  const address = buildAddress(data);
  const phone = compactText(data.contact) || null;

  return {
    title: compactText(data.title) || `리뷰노트 체험단 #${campaignId}`,
    site: "리뷰노트",
    reward: normalizeOffer(data),
    status: "unscheduled",
    detailUrl: href,
    experienceStartDate,
    experienceEndDate,
    reviewDeadline,
    selectedDate: null,
    capacity: "미정",
    companyName: compactText(data.user?.companyName) || compactText(data.title) || "리뷰노트 업체",
    companyPhone: phone,
    address: address || "주소 정보 없음",
    memo: buildMemo(data),
    sticker: "리뷰노트 실파싱",
    accent: "from-[#ffa1cb] via-[#ffd0e4] to-[#fff0f7]",
    contactLocked: !phone,
  };
}
