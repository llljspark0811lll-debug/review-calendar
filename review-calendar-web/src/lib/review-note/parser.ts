import type { ParsedCampaign } from "@/lib/parsers/types";

type ReviewNoteCampaignResponse = {
  id: number;
  title?: string;
  offer?: string;
  applyStartAt?: string;
  applyEndAt?: string;
  reviewEndAt?: string;
  extendedReviewEndAt?: string | null;
  address1?: string | null;
  address2?: string | null;
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
    throw new Error("체험단 일정 정보를 확인하지 못했어요.");
  }

  const date = new Date(input);

  if (Number.isNaN(date.getTime())) {
    throw new Error("체험단 날짜 형식이 올바르지 않아요.");
  }

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
  return [
    data.sort ? `유형: ${data.sort}` : "",
    data.city ? `지역: ${data.city}` : "",
    data.category?.title ? `카테고리: ${data.category.title}` : "",
    "업체 연락처는 선정 페이지에서 확인 후 직접 입력한 값으로 저장돼요.",
  ]
    .filter(Boolean)
    .join(" / ");
}

export async function parseReviewNoteCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const response = await fetch(
    `https://www.reviewnote.co.kr/api/campaign?id=${campaignId}`,
    {
      headers: {
        accept: "application/json, text/plain, */*",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      "리뷰노트 공개 정보를 불러오지 못했어요. 링크가 올바른지 확인해 주세요.",
    );
  }

  const data = (await response.json()) as ReviewNoteCampaignResponse;
  const experienceStartDate = formatDateString(data.applyEndAt, 1);
  const reviewDeadline = formatDateString(
    data.extendedReviewEndAt ?? data.reviewEndAt,
  );
  const experienceEndDate = formatDateString(data.reviewEndAt);
  const address = buildAddress(data);

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
    companyName:
      compactText(data.user?.companyName) ||
      compactText(data.title) ||
      "리뷰노트 업체",
    companyPhone: null,
    address: address || "주소 정보 없음",
    memo: buildMemo(data),
    sticker: "리뷰노트",
    accent: "from-[#ffa1cb] via-[#ffd0e4] to-[#fff0f7]",
    contactLocked: false,
  };
}
