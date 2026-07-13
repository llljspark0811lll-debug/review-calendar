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
    "업체 연락처는 선정 페이지에서 확인한 뒤 직접 입력한 값으로 저장됐어요.",
  ]
    .filter(Boolean)
    .join(" / ");
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
    .replace(/<br[^>]*>/gi, "\n")
    // 중첩된 <div>/<p>는 자기 시작 지점에서도 줄이 나뉘어야 한다 - 닫는 태그만
    // 기준으로 삼으면 "부모 텍스트<div>자식 텍스트</div>" 형태에서 부모 텍스트와
    // 자식 텍스트 사이에 줄바꿈이 안 들어가 서로 다른 문장이 붙어버린다.
    .replace(/<(div|p)(\s[^>]*)?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|td|th|h[1-6]|section|header|footer|label|dt|dd|a)>/gi, "\n")
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

// extractValueAfterLabel과 달리 줄 단위 구조(예약 안내 항목, 키워드 목록, 미션
// 체크리스트)를 공백 한 칸으로 뭉개지 않고 줄바꿈으로 보존한다.
function extractValueAfterLabelMultiline(
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

  return collected.join("\n").trim();
}

const phoneNumberLinePattern = /^\d{2,4}-\d{3,4}-\d{4}$/;

// "복사" 버튼 텍스트, 담당자 연락처(업체 연락처는 항상 수동 입력이라 자동 노출하지
// 않는다) 관련 줄은 상세 내용에서 제외한다.
function stripNoiseLines(text: string) {
  return text
    .split("\n")
    .filter(
      (line) =>
        line !== "복사" &&
        line !== "담당자 연락처" &&
        line !== "연락처 복사" &&
        !phoneNumberLinePattern.test(line),
    )
    .join("\n")
    .trim();
}

function extractTitle(lines: string[]) {
  return lines.find((line) => /^\[[^\]]+\]\s*\S/.test(line)) ?? "";
}

// FullCalendar(v6)는 여러 날짜에 걸친 일정을 "주" 단위로 잘라 각 주의 시작 셀에만
// <a class="fc-event">를 렌더링하고, 나머지 폭은 종료일 텍스트 없이 harness div의
// CSS `right`(px) 오프셋만으로 표현한다. 그래서 각 조각(segment)이 실제로 며칠을
// 덮는지는 픽셀 오프셋을 한 칸(요일 컬럼) 너비로 나눠 역산해야 한다.
type CalendarSegment = {
  date: string;
  title: string;
  isStart: boolean;
  isEnd: boolean;
  rightPx: number | null;
};

function parseDateUTC(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateStr: string, days: number) {
  const date = parseDateUTC(dateStr);
  date.setUTCDate(date.getUTCDate() + days);

  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function dayOfWeek(dateStr: string) {
  return parseDateUTC(dateStr).getUTCDay();
}

function extractCalendarSegments(html: string): CalendarSegment[] {
  const cellPattern =
    /<td[^>]*\bdata-date="(\d{4}-\d{2}-\d{2})"[^>]*>([\s\S]*?)(?=<td[^>]*\bdata-date="|<\/tr>|$)/g;
  const segments: CalendarSegment[] = [];
  let cellMatch: RegExpExecArray | null;

  while ((cellMatch = cellPattern.exec(html))) {
    const [, date, cellHtml] = cellMatch;
    const eventPattern =
      /<div class="fc-daygrid-event-harness[^"]*"[^>]*style="([^"]*)"[^>]*>[\s\S]*?<a[^>]*\bclass="([^"]*\bfc-event\b[^"]*)"[^>]*>[\s\S]*?<div class="fc-event-title[^"]*"[^>]*>([^<]*)<\/div>/g;
    let eventMatch: RegExpExecArray | null;

    while ((eventMatch = eventPattern.exec(cellHtml))) {
      const [, harnessStyle, classAttr, rawTitle] = eventMatch;
      const rightMatch = harnessStyle.match(/right:\s*(-?[0-9.]+)px/);

      segments.push({
        date,
        title: decodeEntities(rawTitle),
        isStart: /\bfc-event-start\b/.test(classAttr),
        isEnd: /\bfc-event-end\b/.test(classAttr),
        rightPx: rightMatch ? Math.abs(Number(rightMatch[1])) : null,
      });
    }
  }

  return segments;
}

// 주 경계까지 이어지는(=isEnd가 아닌) 조각은 폭이 "요일 컬럼 개수"로 정확히
// 정해져 있으므로, 그 조각들의 실측 px폭을 컬럼 개수로 나눠 컬럼 너비를 역산한다.
function calibrateColumnWidthPx(segments: CalendarSegment[]) {
  const samples: number[] = [];

  for (const segment of segments) {
    if (segment.isEnd || segment.rightPx === null) {
      continue;
    }

    const columnsToRowEnd = 6 - dayOfWeek(segment.date);

    if (columnsToRowEnd > 0) {
      samples.push(segment.rightPx / columnsToRowEnd);
    }
  }

  if (samples.length === 0) {
    return null;
  }

  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

function segmentSpanDays(segment: CalendarSegment, columnWidthPx: number | null) {
  if (!segment.isEnd) {
    return 6 - dayOfWeek(segment.date);
  }

  if (segment.rightPx === null || columnWidthPx === null) {
    return 0;
  }

  return Math.round(segment.rightPx / columnWidthPx);
}

function computeEventRange(
  segments: CalendarSegment[],
  title: string,
  columnWidthPx: number | null,
) {
  const matches = segments.filter((segment) => segment.title === title);

  if (matches.length === 0) {
    return null;
  }

  const computedEnds = matches.map((segment) =>
    addDays(segment.date, segmentSpanDays(segment, columnWidthPx)),
  );
  const starts = matches
    .filter((segment) => segment.isStart)
    .map((segment) => segment.date)
    .sort();
  const ends = matches
    .map((segment, index) => ({ isEnd: segment.isEnd, end: computedEnds[index] }))
    .filter((item) => item.isEnd)
    .map((item) => item.end)
    .sort();
  const allStartDates = matches.map((segment) => segment.date).sort();
  const allEndDates = [...computedEnds].sort();

  return {
    start: starts[0] ?? allStartDates[0],
    end: ends[ends.length - 1] ?? allEndDates[allEndDates.length - 1],
  };
}

export function parseReviewNoteCampaignHtml(
  html: string,
  href: string,
): ParsedCampaign {
  const lines = htmlToLines(html);
  const title = extractTitle(lines) || "리뷰노트 체험단";
  const reward =
    extractValueAfterLabel(lines, "제공서비스/물품", ["방문 정보", "방문 주소", "키워드 정보"]) ||
    "제공 내역 확인 필요";
  const address =
    extractValueAfterLabel(lines, "방문 주소", ["방문 및 예약 안내", "예약 시 주의사항", "키워드 정보"]) ||
    "주소 확인 필요";
  const visitInfo = extractValueAfterLabelMultiline(lines, "방문 및 예약 안내", [
    "키워드 정보",
    "체험단 미션",
  ]);
  const keywords = stripNoiseLines(
    extractValueAfterLabelMultiline(lines, "키워드 정보", ["체험단 미션"]),
  )
    .split("\n")
    .filter(Boolean)
    .join(" | ");
  const mission = stripNoiseLines(
    extractValueAfterLabelMultiline(lines, "체험단 미션", [
      "공정위 문구(배너)",
      "체험단 일정",
    ]),
  );
  const detailMemo = [
    visitInfo && `방문 및 예약 안내\n${visitInfo}`,
    keywords && `키워드 정보\n${keywords}`,
    mission && `체험단 미션\n${mission}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const segments = extractCalendarSegments(html);
  const columnWidthPx = calibrateColumnWidthPx(segments);
  const experiencePeriod = computeEventRange(segments, "체험&리뷰", columnWidthPx);
  const deadline = computeEventRange(segments, "마감", columnWidthPx);

  if (!experiencePeriod) {
    throw new Error(
      "리뷰노트 체험단 일정을 확인하지 못했어요. 체험단 일정 캘린더가 포함되도록 페이지 전체를 다시 복사해서 붙여넣어 주세요.",
    );
  }

  return {
    title,
    site: "리뷰노트",
    reward,
    status: "unscheduled",
    detailUrl: href,
    experienceStartDate: experiencePeriod.start,
    experienceEndDate: experiencePeriod.end,
    reviewDeadline: deadline?.end ?? experiencePeriod.end,
    selectedDate: null,
    capacity: "미정",
    companyName: title.replace(/^\[[^\]]+\]\s*/, "") || "리뷰노트 업체",
    companyPhone: null,
    address,
    memo: detailMemo || "방문 및 예약 안내를 확인해 주세요.",
    sticker: "리뷰노트",
    accent: "from-[#ffa1cb] via-[#ffd0e4] to-[#fff0f7]",
    contactLocked: false,
  };
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
        referer: href,
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      },
      cache: "no-store",
    },
  );

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "리뷰노트는 로그인 없이 상세 정보를 제공하지 않아 자동 등록할 수 없어요. 현재는 강남맛집처럼 공개 상세 정보가 열려 있는 링크만 자동 등록할 수 있어요.",
    );
  }

  if (!response.ok) {
    throw new Error(
      "리뷰노트 상세 정보를 불러오지 못했어요. 링크가 올바른지 확인해 주세요.",
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
