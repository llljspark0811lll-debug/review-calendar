import { NextResponse } from "next/server";
import { listCampaigns, listHolidaysInRange, listSiteConnections } from "@/lib/db";
import { ensureHolidayCoverageForYears } from "@/lib/holidays";

export const runtime = "nodejs";

export async function GET() {
  const currentYear = new Date().getFullYear();
  try {
    await ensureHolidayCoverageForYears([currentYear, currentYear + 1]);
  } catch (error) {
    console.error("Holiday sync failed during bootstrap:", error);
  }

  return NextResponse.json({
    campaigns: listCampaigns(),
    siteConnections: listSiteConnections(),
    holidays: listHolidaysInRange(`${currentYear}-01-01`, `${currentYear + 1}-12-31`),
    holidaySyncEnabled: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
  });
}
