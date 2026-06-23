import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const REVIEW_NOTE_SAMPLE_URL = "https://www.reviewnote.co.kr/campaigns/1244064";
const REVIEW_NOTE_STORAGE_DIR = path.join(process.cwd(), ".local");
const REVIEW_NOTE_STORAGE_PATH = path.join(
  REVIEW_NOTE_STORAGE_DIR,
  "reviewnote-storage.json",
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
  await fs.mkdir(REVIEW_NOTE_STORAGE_DIR, { recursive: true });
}

async function readStorageState(): Promise<StorageState | null> {
  try {
    const raw = await fs.readFile(REVIEW_NOTE_STORAGE_PATH, "utf8");
    return JSON.parse(raw) as StorageState;
  } catch {
    return null;
  }
}

function isCookieUsable(cookie: StorageCookie, hostname: string) {
  const expiresMs =
    cookie.expires === -1 ? Number.POSITIVE_INFINITY : cookie.expires * 1000;
  const notExpired = expiresMs > Date.now();
  const domainMatch =
    hostname === cookie.domain.replace(/^\./, "") ||
    hostname.endsWith(cookie.domain.replace(/^\./, ""));

  return notExpired && domainMatch;
}

export async function hasReviewNoteSession() {
  const state = await readStorageState();

  if (!state) {
    return false;
  }

  return state.cookies.some((cookie) =>
    isCookieUsable(cookie, "www.reviewnote.co.kr"),
  );
}

export async function getReviewNoteCookieHeader() {
  const state = await readStorageState();

  if (!state) {
    return null;
  }

  const usableCookies = state.cookies.filter((cookie) =>
    isCookieUsable(cookie, "www.reviewnote.co.kr"),
  );

  if (!usableCookies.length) {
    return null;
  }

  return usableCookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

export async function clearReviewNoteSession() {
  try {
    await fs.unlink(REVIEW_NOTE_STORAGE_PATH);
  } catch {
    // 세션 파일이 없으면 무시한다.
  }
}

export async function launchReviewNoteLogin() {
  await ensureStorageDir();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(REVIEW_NOTE_SAMPLE_URL, {
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
        const status = await page.evaluate(async () => {
          const response = await fetch("/api/campaign?id=1244064", {
            credentials: "include",
          });
          return response.status;
        });

        if (status === 200) {
          loggedIn = true;
          break;
        }
      } catch {
        // 로그인 전에는 fetch가 실패하거나 401이 날 수 있다.
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error(
        "로그인 완료를 확인하지 못했어요. 로그인 후 창을 너무 빨리 닫았다면 다시 시도해 주세요.",
      );
    }

    await context.storageState({ path: REVIEW_NOTE_STORAGE_PATH });
  } finally {
    if (browser.isConnected()) {
      await browser.close();
    }
  }

  return {
    ok: true,
    message: "리뷰노트 로그인 세션을 저장했어요.",
  };
}
