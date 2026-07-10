import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCampaigns, listHolidaysInRange } from "@/lib/db";
import { ensureHolidayCoverageForYears } from "@/lib/holidays";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  const currentYear = new Date().getFullYear();
  try {
    await ensureHolidayCoverageForYears([currentYear, currentYear + 1]);
  } catch (error) {
    console.error("Holiday sync failed during bootstrap:", error);
  }

  return NextResponse.json({
    campaigns: await listCampaigns(user.id),
    holidays: await listHolidaysInRange(`${currentYear}-01-01`, `${currentYear + 1}-12-31`),
    holidaySyncEnabled: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
  });
}
