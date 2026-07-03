export const siteLoginConnectors = [
  {
    id: "reviewnote",
    domain: "reviewnote.co.kr",
    displayName: "리뷰노트",
    loginPath: "/api/reviewnote/login",
    sessionPath: "/api/reviewnote/session",
    openingMessage:
      "리뷰노트 로그인 창을 열고 있어요. 로그인 완료가 확인되면 자동으로 창이 닫혀요.",
    successMessage: "리뷰노트 로그인 연동이 완료됐어요.",
    errorMessage: "리뷰노트 로그인 연동 중 문제가 생겼어요.",
  },
  {
    id: "gangnam",
    domain: "xn--939au0g4vj8sq.net",
    displayName: "강남맛집",
    loginPath: "/api/gangnam/login",
    sessionPath: "/api/gangnam/session",
    openingMessage:
      "강남맛집 로그인 창에서 로그인해 주세요. 로그인 완료가 확인되면 자동으로 창이 닫혀요.",
    successMessage: "강남맛집 로그인 연동이 완료됐어요.",
    errorMessage: "강남맛집 로그인 연동 중 문제가 생겼어요.",
  },
] as const;

export type SiteLoginConnector = (typeof siteLoginConnectors)[number];
export type SiteLoginConnectorId = SiteLoginConnector["id"];

function normalizeDomain(domain: string) {
  return domain.trim().replace(/^www\./, "");
}

export function findSiteLoginConnectorByDomain(domain: string) {
  const normalizedDomain = normalizeDomain(domain);

  return siteLoginConnectors.find(
    (connector) => connector.domain === normalizedDomain,
  );
}
