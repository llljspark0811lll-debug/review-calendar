import { randomUUID } from "node:crypto";
import { launchVisibleBrowser } from "@/lib/browser";
import {
  deleteExternalSiteSession,
  findExternalSiteSession,
  upsertExternalSiteSession,
} from "@/lib/db";

const GANGNAM_BASE_URL = "https://xn--939au0g4vj8sq.net";
const GANGNAM_LOGIN_URL = `${GANGNAM_BASE_URL}/bbs/login.php?url=%2Fcp%2F%3Fid%3D2207100`;
const GANGNAM_CONNECTOR_ID = "gangnam";

type StorageCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
};

type StorageState = {
  cookies: StorageCookie[];
  origins: Array<unknown>;
};

async function readStorageState(userId: string): Promise<StorageState | null> {
  const state = await findExternalSiteSession(userId, GANGNAM_CONNECTOR_ID);
  return state ? (state as StorageState) : null;
}

function isCookieUsable(cookie: StorageCookie, hostname: string) {
  const expiresMs =
    cookie.expires === -1 ? Number.POSITIVE_INFINITY : cookie.expires * 1000;
  const normalizedDomain = cookie.domain.replace(/^\./, "");
  const notExpired = expiresMs > Date.now();
  const domainMatch =
    hostname === normalizedDomain || hostname.endsWith(normalizedDomain);

  return notExpired && domainMatch;
}

export async function hasGangnamSession(userId: string) {
  const state = await readStorageState(userId);

  if (!state) {
    return false;
  }

  return state.cookies.some((cookie) =>
    isCookieUsable(cookie, "xn--939au0g4vj8sq.net"),
  );
}

export async function getGangnamCookieHeader(userId: string) {
  const state = await readStorageState(userId);

  if (!state) {
    return null;
  }

  const usableCookies = state.cookies.filter((cookie) =>
    isCookieUsable(cookie, "xn--939au0g4vj8sq.net"),
  );

  if (!usableCookies.length) {
    return null;
  }

  return usableCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export async function clearGangnamSession(userId: string) {
  await deleteExternalSiteSession(userId, GANGNAM_CONNECTOR_ID);
}

export async function launchGangnamLogin(userId: string) {
  const browser = await launchVisibleBrowser();
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: null,
  });
  const page = await context.newPage();

  try {
    await page.goto(GANGNAM_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 120000,
    });

    const startedAt = Date.now();
    let loggedIn = false;

    while (Date.now() - startedAt < 1000 * 60 * 10) {
      if (page.isClosed()) {
        break;
      }

      try {
        loggedIn = await page.evaluate(() => {
          const memberFlag = String(
            (globalThis as typeof globalThis & { g5_is_member?: string })
              .g5_is_member ?? "",
          );
          const bodyText = document.body?.innerText ?? "";

          return (
            Boolean(memberFlag) ||
            bodyText.includes("로그아웃") ||
            (!location.href.includes("/bbs/login.php") &&
              document.cookie.includes("PHPSESSID"))
          );
        });

        if (loggedIn) {
          break;
        }
      } catch {
        // Login pages can navigate while the in-page check is running.
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error(
        "강남맛집 로그인 완료를 확인하지 못했어요. 로그인 창을 너무 빨리 닫았다면 다시 시도해 주세요.",
      );
    }

    await upsertExternalSiteSession({
      id: randomUUID(),
      userId,
      connectorId: GANGNAM_CONNECTOR_ID,
      storageState: await context.storageState(),
    });
  } finally {
    if (browser.isConnected()) {
      await browser.close();
    }
  }

  return {
    ok: true,
    message: "강남맛집 로그인 세션을 저장했어요.",
  };
}
