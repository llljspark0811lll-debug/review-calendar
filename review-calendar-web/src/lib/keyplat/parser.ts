import { UserFacingError } from "@/lib/errors";
import type { ParsedCampaign } from "@/lib/parsers/types";

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

// 날짜가 "MM.DD(요일)"처럼 연도 없이 내려오기 때문에, 오늘 날짜와 가장 가까운
// 연도(작년/올해/내년 중)를 골라 붙인다. 신청기간·리뷰등록기간처럼 여러 날짜가
// 뒤섞여 나열되는 경우도 있어(리뷰 등록기간 시작일이 신청기간 마감일보다 빠른
// 경우도 실제로 있었다) 날짜 순서에 기대지 않고 각 날짜를 독립적으로 판단한다.
function resolveYearForMonthDay(month: number, day: number, referenceDate: Date) {
  const refYear = referenceDate.getFullYear();
  let bestYear = refYear;
  let bestDiff = Infinity;

  for (const year of [refYear - 1, refYear, refYear + 1]) {
    const candidate = new Date(Date.UTC(year, month - 1, day));
    const diff = Math.abs(candidate.getTime() - referenceDate.getTime());

    if (diff < bestDiff) {
      bestDiff = diff;
      bestYear = year;
    }
  }

  return bestYear;
}

function parseStepDate(value: string) {
  const match = value.match(/(\d{1,2})\.(\d{1,2})/);

  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = resolveYearForMonthDay(month, day, new Date());

  return `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
}

function parseStepRange(value: string) {
  const parts = value.split("~").map((part) => part.trim());

  if (parts.length === 2) {
    const start = parseStepDate(parts[0]);
    const end = parseStepDate(parts[1]);
    return start && end ? { start, end } : null;
  }

  const single = parseStepDate(value);
  return single ? { start: single, end: single } : null;
}

function buildCampaign(fields: {
  title: string;
  reward: string;
  keywords: string;
  reviewGuide: string;
  extraNotice: string;
  address: string;
  selectionDate: string | null;
  reviewPeriod: { start: string; end: string } | null;
  capacity: string;
  detailUrl: string;
}): ParsedCampaign {
  const { title, reward, keywords, reviewGuide, extraNotice, address, selectionDate, reviewPeriod, capacity, detailUrl } =
    fields;

  if (!selectionDate || !reviewPeriod) {
    throw new UserFacingError(
      "키플랫 체험단 일정을 확인하지 못했어요. 선정된 체험단 상세 페이지 전체를 다시 복사해서 붙여넣어 주세요.",
    );
  }

  const memo = [
    keywords && `키워드\n${keywords}`,
    reviewGuide && `리뷰가이드\n${reviewGuide}`,
    extraNotice && `추가 안내사항\n${extraNotice}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    title,
    site: "키플랫",
    reward: reward || "제공 내역 확인 필요",
    status: "unscheduled",
    detailUrl,
    // 체험 가능 기간을 별도로 명시하지 않는 사이트라, "선정자 발표일"을 체험
    // 시작일로, "리뷰 등록기간" 종료일을 체험 종료일 겸 리뷰 마감일로 쓴다.
    experienceStartDate: selectionDate,
    experienceEndDate: reviewPeriod.end,
    reviewDeadline: reviewPeriod.end,
    selectedDate: null,
    capacity,
    companyName: title.replace(/^\[[^\]]+\]\s*/, "") || "키플랫 업체",
    companyPhone: null,
    address: address || "주소 확인 필요",
    memo: memo || "캠페인 상세 내용을 확인해 주세요.",
    sticker: "키플랫",
    accent: "from-[#c4b5fd] via-[#ddd6fe] to-[#f5f3ff]",
    contactLocked: false,
  };
}

function contentHtmlToText(html: string) {
  const withBreaks = html.replace(/<br[^>]*>/gi, "\n").replace(/<[^>]+>/g, "");

  return withBreaks
    .split("\n")
    .map((line) => decodeEntities(line))
    .filter(Boolean)
    .join("\n");
}

function singleLine(text: string) {
  return text.replace(/\n/g, " ").trim();
}

// 브라우저 Ctrl+C 복사는 선택 영역의 모든 태그에 style="..." 속성을 주입하고,
// 경우에 따라 텍스트 구간을 새 <span>으로 한 번 더 감싸기도 한다(체험뷰·강남맛집
// 등 다른 파서에서도 겪은 문제). "<span class=\"tit_basic\">라벨</span>"처럼 태그
// 모양이 정확히 일치해야 하는 정규식은 이 상황에서 전부 깨진다. 반면 id/class
// 속성값 자체는 절대 쪼개지지 않으므로, 속성값을 찾은 뒤 다음에 나오는 "다른
// 종류의" 닫는 태그(예: content span이 아니라 그 부모인 li)까지를 통째로 잘라
// 태그를 걷어내는 방식은 중첩 span 개수와 무관하게 안전하다.
function extractBoundedContent(
  html: string,
  anchorAttr: string,
  innerAttr: string,
  stopTag: string,
  fromIndex = 0,
) {
  const anchorIndex = html.indexOf(anchorAttr, fromIndex);

  if (anchorIndex === -1) {
    return "";
  }

  const stopIndex = html.indexOf(stopTag, anchorIndex);

  if (stopIndex === -1) {
    return "";
  }

  const innerIndex = html.indexOf(innerAttr, anchorIndex);

  if (innerIndex === -1 || innerIndex > stopIndex) {
    return "";
  }

  const openEnd = html.indexOf(">", innerIndex);

  if (openEnd === -1 || openEnd > stopIndex) {
    return "";
  }

  return contentHtmlToText(html.slice(openEnd + 1, stopIndex));
}

// 키플랫은 "제공내역/키워드/리뷰가이드/추가 안내사항"을 전부
// <li id="tanz_pageN"><span class="tit_basic">라벨</span><span class="content">내용</span></li>
// 형태로 통일해서 내려준다. 라벨 텍스트 대신 안정적인 li id를 앵커로 쓰고,
// content span의 닫는 태그가 아니라 li의 닫는 태그(</li>)까지를 경계로 잡아서
// content span 안에 중첩 span이 몇 개 끼어들어도 잘리지 않게 한다.
function extractLiContentById(html: string, liId: string) {
  return extractBoundedContent(html, `id="${liId}"`, 'class="content"', "</li>");
}

function extractTitle(html: string) {
  return singleLine(extractBoundedContent(html, 'class="itname"', 'class="itname"', "</div>"));
}

function extractAddressFromHtml(html: string) {
  return singleLine(extractBoundedContent(html, 'class="address"', 'class="address"', "</b>"));
}

function extractCpId(html: string) {
  const match = html.match(/[?&]cp_id=(\d+)/) ?? html.match(/data-cp_id="(\d+)"/);
  return match ? match[1] : null;
}

// review_step_wrap 안의 <em>라벨</em><b>값</b> 네 쌍(신청기간/선정자 발표/
// 리뷰 등록기간/결과발표)은 순서가 고정돼 있어, 라벨 텍스트를 찾는 대신
// 컨테이너 안의 <b> 값들을 등장 순서대로 뽑아 위치로 구분한다.
function extractOrderedTagValues(container: string, tagName: string) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const values: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(container))) {
    values.push(singleLine(contentHtmlToText(match[1])));
  }

  return values;
}

function extractReviewStepValues(html: string) {
  const anchorIndex = html.indexOf('class="review_step_wrap"');

  if (anchorIndex === -1) {
    return [];
  }

  const openEnd = html.indexOf(">", anchorIndex);

  if (openEnd === -1) {
    return [];
  }

  const closeIndex = html.indexOf("</div>", openEnd);

  if (closeIndex === -1) {
    return [];
  }

  return extractOrderedTagValues(html.slice(openEnd + 1, closeIndex), "b");
}

// item_num 컨테이너 자체도 <span>이라 </span>를 경계로 잡으면 안(신청/모집
// 라벨을 감싸는 중첩 span)의 첫 </span>에서 잘려버린다. 컨테이너 경계를 찾는
// 대신, 앵커 이후에 등장하는 첫 두 개의 <b> 값(신청 수/모집 수)을 그대로 쓴다.
function extractCapacityFromHtml(html: string) {
  const anchorIndex = html.indexOf('class="item_num"');

  if (anchorIndex === -1) {
    return "미정";
  }

  const values = extractOrderedTagValues(html.slice(anchorIndex), "b")
    .slice(0, 2)
    .map((value) => value.replace(/\D/g, ""));

  return values[0] && values[1] ? `${values[0]}/${values[1]}` : "미정";
}

function parseTaggedHtml(html: string, href: string): ParsedCampaign {
  const title = extractTitle(html) || "키플랫 체험단";

  const keywords = extractLiContentById(html, "tanz_page3")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .join(" | ");

  const cpId = extractCpId(html);
  // 등장 순서: [0] 리뷰어 신청기간, [1] 선정자 발표, [2] 리뷰 등록기간, [3] 캠페인 결과발표.
  const stepValues = extractReviewStepValues(html);
  const selectionRaw = stepValues[1] ?? "";
  const reviewPeriodRaw = stepValues[2] ?? "";

  return buildCampaign({
    title,
    reward: extractLiContentById(html, "tanz_page2"),
    keywords,
    reviewGuide: extractLiContentById(html, "tanz_page4"),
    extraNotice: extractLiContentById(html, "tanz_page5"),
    address: extractAddressFromHtml(html),
    selectionDate: parseStepDate(selectionRaw),
    reviewPeriod: parseStepRange(reviewPeriodRaw),
    capacity: extractCapacityFromHtml(html),
    detailUrl: href || (cpId ? `https://keyplat.net/review_campaign.php?cp_id=${cpId}` : ""),
  });
}

// 브라우저가 클립보드에 text/html을 실어주지 않아 태그 없는 순수 텍스트만
// 붙여넣어지는 경우가 있다(2026-07-31 확인 — 원인 불명, 같은 사용자가 같은
// 페이지를 다시 복사해도 재현). 이 경로에서도 등록이 가능하도록, 사이트
// 페이지를 브라우저에서 실제로 눈으로 볼 때 보이는 줄바꿈 순서를 기준으로 같은
// 정보를 추출하는 폴백을 둔다. "제공내역/키워드/리뷰가이드/추가 안내사항"
// 라벨은 항상 별도 줄(사이트 CSS가 `display:block`으로 강제)로 떨어지고, 그
// 다음 줄부터가 값이다. 반면 사이드바의 "선정자 발표"/"리뷰 등록기간" 같은
// 일정 라벨은 인라인 요소라 라벨과 값이 한 줄에 붙어서 나온다.
function looksLikeHtml(input: string) {
  return /<[a-zA-Z][^>]*>/.test(input);
}

function textToLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function findLineIndex(lines: string[], predicate: (line: string) => boolean, from = 0) {
  for (let i = from; i < lines.length; i += 1) {
    if (predicate(lines[i])) {
      return i;
    }
  }
  return -1;
}

function collectLinesUntil(
  lines: string[],
  startIndex: number,
  stopPredicate: (line: string) => boolean,
) {
  if (startIndex === -1) {
    return [];
  }

  const collected: string[] = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    if (stopPredicate(lines[i])) {
      break;
    }

    collected.push(lines[i]);
  }

  return collected;
}

function extractPlainStepValue(text: string, label: string) {
  const datePattern = "\\d{1,2}\\.\\d{1,2}(?:\\([^)]*\\))?";
  const pattern = new RegExp(`${label}\\s*(${datePattern}(?:\\s*~\\s*${datePattern})?)`);
  const match = text.match(pattern);
  return match ? match[1] : "";
}

function parsePlainText(text: string, href: string): ParsedCampaign {
  const lines = textToLines(text);

  const titleIndex = findLineIndex(lines, (line) => /^\[[^\]]+\]\s*\S/.test(line));
  const title = titleIndex === -1 ? "키플랫 체험단" : lines[titleIndex];

  const rewardStart = findLineIndex(lines, (line) => line === "제공내역");
  const reward = collectLinesUntil(lines, rewardStart + 1, (line) => line.startsWith("키워드")).join(
    "\n",
  );

  const keywordLabelIndex = findLineIndex(lines, (line) => line.startsWith("키워드"));
  const keywords = (keywordLabelIndex === -1 ? "" : lines[keywordLabelIndex + 1] ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
    .join(" | ");

  const reviewGuideStart = findLineIndex(lines, (line) => line === "리뷰가이드");
  const reviewGuide = collectLinesUntil(
    lines,
    reviewGuideStart + 1,
    (line) => line === "추가 안내사항",
  ).join("\n");

  const extraNoticeStart = findLineIndex(lines, (line) => line === "추가 안내사항");
  const extraNotice = collectLinesUntil(lines, extraNoticeStart + 1, (line) => line === "주소").join(
    "\n",
  );

  const addressLabelIndex = findLineIndex(lines, (line) => line === "주소");
  const address = addressLabelIndex === -1 ? "" : lines[addressLabelIndex + 1] ?? "";

  const capacityMatch = text.match(/신청\s*(\d+)\s*\/\s*모집\s*(\d+)/);
  const capacity = capacityMatch ? `${capacityMatch[1]}/${capacityMatch[2]}` : "미정";

  const selectionRaw = extractPlainStepValue(text, "선정자 발표");
  const reviewPeriodRaw = extractPlainStepValue(text, "리뷰 등록기간");

  return buildCampaign({
    title,
    reward,
    keywords,
    reviewGuide,
    extraNotice,
    address,
    selectionDate: parseStepDate(selectionRaw),
    reviewPeriod: parseStepRange(reviewPeriodRaw),
    capacity,
    detailUrl: href,
  });
}

export function parseKeyplatCampaignHtml(html: string, href: string): ParsedCampaign {
  return looksLikeHtml(html) ? parseTaggedHtml(html, href) : parsePlainText(html, href);
}

export async function parseKeyplatCampaign(): Promise<ParsedCampaign> {
  // 키플랫 상세 페이지는 로그인 여부에 따라 응답이 달라질 수 있는지 확인되지
  // 않아, 다른 사이트처럼 서버 fetch로 링크만 넣는 경로는 지원하지 않는다.
  // 선정된 체험단 상세 페이지 전체를 복사해서 붙여넣는 방식으로만 지원한다.
  throw new UserFacingError(
    "키플랫은 아직 링크만으로는 자동 등록할 수 없어요. 선정된 체험단 상세 페이지에서 전체 복사(Ctrl+A → Ctrl+C)해서 붙여넣어 주세요.",
  );
}
