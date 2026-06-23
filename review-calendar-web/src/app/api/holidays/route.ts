import { NextResponse } from "next/server";
import { listHolidaysInRange } from "@/lib/db";
import { refreshHolidayCoverageForYears } from "@/lib/holidays";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { message: "startDate와 endDate가 필요해요." },
      { status: 400 },
    );
  }

  const startYear = Number.parseInt(startDate.slice(0, 4), 10);
  const endYear = Number.parseInt(endDate.slice(0, 4), 10);

  if (Number.isNaN(startYear) || Number.isNaN(endYear)) {
    return NextResponse.json(
      { message: "날짜 형식이 올바르지 않아요." },
      { status: 400 },
    );
  }

  const years: number[] = [];
  for (let year = startYear; year <= endYear; year += 1) {
    years.push(year);
  }

  try {
    await refreshHolidayCoverageForYears(years);
  } catch (error) {
    console.error("Holiday refresh failed:", error);
  }

  return NextResponse.json({
    holidays: listHolidaysInRange(startDate, endDate),
    holidaySyncEnabled: Boolean(process.env.DATA_GO_KR_SERVICE_KEY),
  });
}
