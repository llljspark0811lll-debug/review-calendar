import { lookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { promisify } from "node:util";
import type { ParsedCampaign } from "@/lib/parsers/types";

const GANGNAM_HOST = "xn--939au0g4vj8sq.net";
const GANGNAM_FALLBACK_IP = "222.239.248.179";
const lookupAsync = promisify(lookup);

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

function extractMatch(html: string, pattern: RegExp) {
  return pattern.exec(html)?.[1];
}

function extractDetailValue(html: string, label: string) {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return compactText(
    extractMatch(
      html,
      new RegExp(
        `<dt>\\s*${escapedLabel}\\s*<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`,
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
    compactText(html),
  ].filter(Boolean);
  const addressPattern =
    /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]*?(?:\d{1,5}(?:-\d{1,5})?)[^\n]*)/;

  for (const candidate of candidates) {
    const address = candidate.match(addressPattern)?.[1]?.trim();

    if (address) {
      return address;
    }
  }

  return "";
}

function requestHtml(url: string) {
  return new Promise<string>((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === "https:";
    const requestFn = isHttps ? httpsRequest : httpRequest;
    const req = requestFn(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        headers: {
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          host: GANGNAM_HOST,
          "user-agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
        },
        lookup(hostname, options, callback) {
          if (hostname === GANGNAM_HOST) {
            lookup(hostname, { ...options, family: 4 }, callback);
            return;
          }
          lookup(hostname, options, callback);
        },
        rejectUnauthorized: false,
        servername: GANGNAM_HOST,
        timeout: 25000,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;

        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          const redirectUrl = new URL(response.headers.location, parsedUrl).toString();
          requestHtml(redirectUrl).then(resolve).catch(reject);
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve(Buffer.concat(chunks).toString("utf8"));
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error("request timeout"));
    });
    req.on("error", reject);
    req.end();
  });
}

async function buildGangnamUrls(campaignId: string) {
  const urls = [
    `http://${GANGNAM_HOST}/cp/?id=${campaignId}`,
    `http://${GANGNAM_FALLBACK_IP}/cp/?id=${campaignId}`,
    `https://${GANGNAM_HOST}/cp/?id=${campaignId}`,
  ];

  try {
    const result = await lookupAsync(GANGNAM_HOST, { family: 4 });
    if (result.address !== GANGNAM_FALLBACK_IP) {
      urls.splice(1, 0, `http://${result.address}/cp/?id=${campaignId}`);
    }
  } catch {
    // Static fallback IP remains available when DNS lookup fails.
  }

  return urls;
}

async function fetchGangnamHtml(campaignId: string) {
  const urls = await buildGangnamUrls(campaignId);
  let lastError: unknown;

  for (const url of urls) {
    try {
      return await requestHtml(url);
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? ` (${lastError.message})` : "";
  throw new Error(`강남맛집 체험단 정보를 불러오지 못했어요${message}.`);
}

export async function parseGangnamCampaign(
  campaignId: string,
  href: string,
): Promise<ParsedCampaign> {
  const html = await fetchGangnamHtml(campaignId);
  const title =
    compactText(extractMatch(html, /<p class="tit">\s*([\s\S]*?)\s*<\/p>/i)) ||
    decodeHtmlAttribute(
      extractMatch(html, /<meta property=['"]og:title['"] content=['"]([^'"]+)['"]/i),
    ) ||
    `강남맛집 체험단 #${campaignId}`;
  const reward =
    extractDetailValue(html, "제공내역") ||
    compactText(extractMatch(html, /<p class="sub_tit">([\s\S]*?)<\/p>/i)) ||
    decodeHtmlAttribute(
      extractMatch(
        html,
        /<meta property=['"]og:description['"] content=['"]([^'"]+)['"]/i,
      ),
    ) ||
    "제공 내역 확인 필요";
  const reviewPeriod = parseDateRange(extractDetailValue(html, "리뷰 등록기간"));

  if (!reviewPeriod) {
    throw new Error("강남맛집 체험단 기간을 확인하지 못했어요.");
  }

  const visitInfo = extractDetailValue(html, "방문 및 예약");
  const address = extractAddress(html, visitInfo);
  const capacityMatch = html.match(
    /신청\s*<em[^>]*id=["']ask_count["'][^>]*>\s*(\d+)\s*<\/em>\s*\/\s*(\d+)/i,
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
    companyPhone: null,
    address: address || "주소 확인 필요",
    memo: visitInfo || "방문 및 예약 안내를 확인해 주세요.",
    sticker: "강남맛집",
    accent: "from-[#ffb86b] via-[#ffd6a8] to-[#fff2df]",
    contactLocked: false,
  };
}
