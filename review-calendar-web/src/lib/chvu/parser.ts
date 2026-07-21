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

function htmlToLines(html: string): string[] {
  const withBreaks = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br[^>]*>/gi, "\n")
    .replace(/<(div|p)(\s[^>]*)?>/gi, "\n")
    .replace(/<\/(div|p|li|tr|td|th|h[1-6]|section|header|footer|label|dt|dd|a)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  return withBreaks
    .split("\n")
    .map((line) => decodeEntities(line))
    .filter(Boolean);
}

// 체험뷰 페이지의 각 항목 라벨 옆에 붙는 물음표 툴팁 설명, 복사 버튼 텍스트는
// 모든 캠페인에 공통으로 붙는 UI 문구라 상세 내용에서는 노이즈일 뿐이다.
const noiseLinePatterns = [
  /^제공포인트\s*[:：]/,
  /^(태그복사|키워드복사)$/,
  /^안내된 해시태그를 인스타그램 피드 본문 또는 댓글에 남겨주세요$/,
  /^인스타그램 사진 업로드 또는 수정페이지에서$/,
  /^사람태그하기를 눌러 안내된 인스타그램 계정을 태그해주세요\.?$/,
  /^검색키워드를 제목과 본문에 넣어주세요$/,
];

function filterNoiseLines(lines: string[]) {
  return lines.filter((line) => !noiseLinePatterns.some((pattern) => pattern.test(line)));
}

// 라벨이 한 줄짜리("제공내역")도 있고, 반응형 숨김용 빈 <div>가 라벨 중간에
// 끼어들어 두 줄로 쪼개지는 경우("가이드라인/" + "요청사항")도 있어서, 라벨을
// 연속된 줄들의 시퀀스로 취급한다.
function findSequenceEnd(lines: string[], sequence: string[]) {
  for (let i = 0; i <= lines.length - sequence.length; i += 1) {
    if (sequence.every((part, offset) => lines[i + offset] === part)) {
      return i + sequence.length;
    }
  }
  return -1;
}

function collectUntil(lines: string[], startIndex: number, stopLabels: string[]) {
  if (startIndex === -1) {
    return [];
  }

  const collected: string[] = [];

  for (let i = startIndex; i < lines.length; i += 1) {
    if (stopLabels.includes(lines[i])) {
      break;
    }

    collected.push(lines[i]);
  }

  return collected;
}

function extractSection(
  lines: string[],
  label: string | string[],
  stopLabels: string[],
) {
  const sequence = Array.isArray(label) ? label : [label];
  return collectUntil(lines, findSequenceEnd(lines, sequence), stopLabels);
}

// 방문 및 예약안내 영역에는 네이버 지도 위젯이 통째로 끼어있는데, 지도
// 렌더링용 div 수백 개가 중첩돼 있어 태그 균형을 맞춰 걷어내기 어렵다. 대신
// 지도 바로 다음에 항상 주소 div가 이어지는 구조를 이용해, 지도 시작 지점부터
// 주소 div 시작 직전까지를 통째로 잘라낸다.
function stripMapWidget(html: string) {
  return html.replace(
    /<div class="[^"]*CampaignMap__Map[^"]*"[\s\S]*?(?=<div class="[^"]*CampaignMain__Address)/i,
    "",
  );
}

function extractAddress(html: string) {
  const match = html.match(
    /<div class="[^"]*CampaignMain__Address[^"]*"[^>]*>([^<]*)<\/div>/i,
  );
  return match ? decodeEntities(match[1]) : "";
}

function stripAddressBlock(html: string) {
  return html.replace(
    /<div class="[^"]*CampaignMain__Address[^"]*"[^>]*>[^<]*<\/div>/i,
    "",
  );
}

// 우측 사이드바(신청자현황/모집시작일/모집마감일/리뷰마감일)는 폭이 좁아서
// 브라우저가 글자 단위로 줄바꿈해 그리는 경우가 있는데, 그 상태에서
// Ctrl+A/Ctrl+C로 복사하면 크롬이 줄바꿈 지점마다 "공백 전용 <span> </span>"을
// 끼워 넣은 채로 복사해버린다("모집마감일" → "모집 마 감 일<span> </span>").
// 그래서 라벨/숫자 사이에 공백뿐 아니라 태그까지 몇 개가 끼어도 매칭되도록
// 글자 하나하나 사이에 "공백 또는 태그 반복"을 허용한다.
const FLEXIBLE_GAP = "(?:<[^>]*>|\\s)*";

function fuzzyLiteral(text: string) {
  return text
    .split("")
    .map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(FLEXIBLE_GAP);
}

function extractDateAfterLabel(html: string, label: string) {
  const digit = `${FLEXIBLE_GAP}(\\d)`;
  const dot = `${FLEXIBLE_GAP}\\.`;
  const pattern = new RegExp(
    `${fuzzyLiteral(label)}${digit}${digit}${dot}${digit}${digit}${dot}${digit}${digit}`,
  );
  const match = html.match(pattern);

  if (!match) {
    return null;
  }

  const [, y1, y2, m1, m2, d1, d2] = match;
  return `20${y1}${y2}-${m1}${m2}-${d1}${d2}`;
}

function addDaysToDateString(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);

  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}-${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

export function parseChvuCampaignHtml(html: string, href: string): ParsedCampaign {
  const cleanedHtml = stripAddressBlock(stripMapWidget(html));
  const lines = filterNoiseLines(htmlToLines(cleanedHtml));

  const title = lines.find((line) => /^\[[^\]]+\]\s*\S/.test(line)) ?? "체험뷰 체험단";
  const address = extractAddress(html) || "주소 확인 필요";

  const reward =
    extractSection(lines, "제공내역", ["방문 및 예약안내"]).join(" ").trim() ||
    "제공 내역 확인 필요";
  const visitInfo = extractSection(lines, "방문 및 예약안내", ["해시태그"])
    .join("\n")
    .trim();
  const hashtags = extractSection(lines, "해시태그", ["사람태그"]).join("\n").trim();
  const peopleTag = extractSection(lines, "사람태그", ["검색 키워드"]).join("\n").trim();
  const searchKeywords = extractSection(lines, "검색 키워드", ["가이드라인/"])
    .join("\n")
    .trim();
  const guideline = extractSection(lines, ["가이드라인/", "요청사항"], ["담당자 연락처"])
    .join("\n")
    .trim();

  const memo = [
    visitInfo && `방문 및 예약안내\n${visitInfo}`,
    hashtags && `해시태그\n${hashtags}`,
    peopleTag && `사람태그\n${peopleTag}`,
    searchKeywords && `검색 키워드\n${searchKeywords}`,
    guideline && `가이드라인/요청사항\n${guideline}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const applyEnd = extractDateAfterLabel(html, "모집마감일");
  const reviewDeadline = extractDateAfterLabel(html, "리뷰마감일");

  if (!applyEnd || !reviewDeadline) {
    throw new UserFacingError(
      "체험뷰 체험단 일정을 확인하지 못했어요. 선정된 체험단 상세 페이지 전체를 다시 복사해서 붙여넣어 주세요.",
    );
  }

  const capacityMatch = html.match(
    new RegExp(`${fuzzyLiteral("신청자현황")}${FLEXIBLE_GAP}(\\d+)${FLEXIBLE_GAP}\\/${FLEXIBLE_GAP}(\\d+)`),
  );
  const capacity = capacityMatch ? `${capacityMatch[1]}/${capacityMatch[2]}` : "미정";

  const campaignCodeMatch = html.match(
    new RegExp(`${fuzzyLiteral("캠페인코드")}${FLEXIBLE_GAP}#${FLEXIBLE_GAP}(\\d+)`),
  );
  const detailUrl =
    href || (campaignCodeMatch ? `https://chvu.co.kr/campaign/${campaignCodeMatch[1]}` : "");

  return {
    title,
    site: "체험뷰",
    reward,
    status: "unscheduled",
    detailUrl,
    experienceStartDate: addDaysToDateString(applyEnd, 1),
    experienceEndDate: reviewDeadline,
    reviewDeadline,
    selectedDate: null,
    capacity,
    companyName: title.replace(/^\[[^\]]+\]\s*/, "") || "체험뷰 업체",
    companyPhone: null,
    address,
    memo: memo || "방문 및 예약안내를 확인해 주세요.",
    sticker: "체험뷰",
    accent: "from-[#6ee7b7] via-[#bdf5db] to-[#effdf6]",
    contactLocked: false,
  };
}

export async function parseChvuCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const response = await fetch(href || `https://chvu.co.kr/campaign/${campaignId}`, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new UserFacingError(
      "체험뷰 상세 정보를 불러오지 못했어요. 링크가 올바른지 확인해 주세요.",
    );
  }

  const html = await response.text();

  if (!html.includes("CampaignMain__Title")) {
    throw new UserFacingError(
      "체험뷰는 페이지 내용이 자바스크립트로 나중에 채워지는 방식이라 링크만으로는 상세 정보를 가져올 수 없어요. 선정된 체험단 상세 페이지에서 전체 복사(Ctrl+A → Ctrl+C)해서 붙여넣어 주세요.",
    );
  }

  return parseChvuCampaignHtml(html, href);
}
