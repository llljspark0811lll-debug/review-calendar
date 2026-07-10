import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import {
  claimNextAutomationJob,
  closeDb,
  insertCampaign,
  markAutomationJobFailed,
  markAutomationJobSucceeded,
} from "../src/lib/db";
import { parseCampaignLink } from "../src/lib/parsers";
import type { Campaign } from "../src/types/campaign";

loadEnvConfig(process.cwd());

const pollIntervalMs = Number.parseInt(
  process.env.WORKER_POLL_INTERVAL_MS ?? "3000",
  10,
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processNextJob() {
  const job = await claimNextAutomationJob();

  if (!job) {
    return false;
  }

  console.log(`[worker] claimed ${job.id} (${job.type})`);

  try {
    if (job.type !== "parse_campaign") {
      throw new Error(`지원하지 않는 작업 유형이에요: ${job.type}`);
    }

    const parsed = await parseCampaignLink(job.input.url, job.userId);
    const campaign: Campaign = {
      ...parsed,
      companyPhone: job.input.companyPhone?.trim() || parsed.companyPhone,
      contactLocked: false,
      id: randomUUID(),
    };

    await insertCampaign(campaign, job.userId);
    await markAutomationJobSucceeded(job.id, { campaignId: campaign.id });

    console.log(`[worker] succeeded ${job.id}`);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "자동 등록 작업 중 오류가 발생했어요.";

    await markAutomationJobFailed(job.id, message);
    console.error(`[worker] failed ${job.id}: ${message}`);
  }

  return true;
}

async function main() {
  console.log("[worker] automation worker started");

  if (process.env.WORKER_ONCE === "1") {
    try {
      await processNextJob();
    } finally {
      await closeDb();
    }
    return;
  }

  while (true) {
    const processed = await processNextJob();

    if (!processed) {
      await sleep(pollIntervalMs);
    }
  }
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
