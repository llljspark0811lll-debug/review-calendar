import { randomUUID } from "node:crypto";
import { launchVisibleBrowser } from "@/lib/browser";
import {
  deleteExternalSiteSession,
  findExternalSiteSession,
  upsertExternalSiteSession,
} from "@/lib/db";

const REVIEW_NOTE_SAMPLE_URL = "https://www.reviewnote.co.kr/campaigns/1244064";
const REVIEW_NOTE_CONNECTOR_ID = "reviewnote";

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
  const state = await findExternalSiteSession(userId, REVIEW_NOTE_CONNECTOR_ID);
  return state ? (state as StorageState) : null;
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

export async function hasReviewNoteSession(userId: string) {
  const state = await readStorageState(userId);

  if (!state) {
    return false;
  }

  return state.cookies.some((cookie) =>
    isCookieUsable(cookie, "www.reviewnote.co.kr"),
  );
}

export async function getReviewNoteCookieHeader(userId: string) {
  const state = await readStorageState(userId);

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

export async function clearReviewNoteSession(userId: string) {
  await deleteExternalSiteSession(userId, REVIEW_NOTE_CONNECTOR_ID);
}

export async function launchReviewNoteLogin(userId: string) {
  const browser = await launchVisibleBrowser();
  const context = await browser.newContext({
    viewport: null,
  });
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
        // Login pages can navigate while the in-page fetch is running.
      }

      await page.waitForTimeout(1000);
    }

    if (!loggedIn) {
      throw new Error(
        "로그인 완료를 확인하지 못했어요. 로그인 창을 너무 빨리 닫았다면 다시 시도해 주세요.",
      );
    }

    await upsertExternalSiteSession({
      id: randomUUID(),
      userId,
      connectorId: REVIEW_NOTE_CONNECTOR_ID,
      storageState: await context.storageState(),
    });
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
