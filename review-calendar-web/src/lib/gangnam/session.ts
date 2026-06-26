import fs from "node:fs/promises";
import path from "node:path";
import { launchVisibleBrowser } from "@/lib/browser";

const GANGNAM_BASE_URL = "https://xn--939au0g4vj8sq.net";
const GANGNAM_LOGIN_URL = `${GANGNAM_BASE_URL}/bbs/login.php?url=%2Fcp%2F%3Fid%3D2207100`;
const GANGNAM_STORAGE_DIR = path.join(process.cwd(), ".local");
const GANGNAM_STORAGE_PATH = path.join(
  GANGNAM_STORAGE_DIR,
  "gangnam-storage.json",
);

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

async function ensureStorageDir() {
  await fs.mkdir(GANGNAM_STORAGE_DIR, { recursive: true });
}

async function readStorageState(): Promise<StorageState | null> {
  try {
    const raw = await fs.readFile(GANGNAM_STORAGE_PATH, "utf8");
    return JSON.parse(raw) as StorageState;
  } catch {
    return null;
  }
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

export async function hasGangnamSession() {
  const state = await readStorageState();

  if (!state) {
    return false;
  }

  return state.cookies.some((cookie) =>
    isCookieUsable(cookie, "xn--939au0g4vj8sq.net"),
  );
}

export async function getGangnamCookieHeader() {
  const state = await readStorageState();

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

export async function clearGangnamSession() {
  try {
    await fs.unlink(GANGNAM_STORAGE_PATH);
  } catch {
    // 세션 파일이 없으면 무시한다.
  }
}

export async function launchGangnamLogin() {
  await ensureStorageDir();

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
        // 페이지 이동 중에는 평가가 실패할 수 있다.
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error(
        "강남맛집 로그인 완료를 확인하지 못했어요. 로그인 창을 너무 빨리 닫았다면 다시 시도해 주세요.",
      );
    }

    await context.storageState({ path: GANGNAM_STORAGE_PATH });
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
