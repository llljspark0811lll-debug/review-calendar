import { NextResponse } from "next/server";
import { listHolidaysInRange } from "@/lib/db";
import { refreshHolidayCoverageForYears } from "@/lib/holidays";

export const runtime = "nodejs";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!startDate || !endDate) {
    return NextResponse.json(
      {
        message:
          "startDate\uc640 endDate\uac00 \ud544\uc694\ud574\uc694.",
      },
      { status: 400 },
    );
  }

  if (!isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    return NextResponse.json(
      {
        message:
          "\ub0a0\uc9dc \ud615\uc2dd\uc774 \uc62c\ubc14\ub974\uc9c0 \uc54a\uc544\uc694.",
      },
      { status: 400 },
    );
  }

  const startYear = Number.parseInt(startDate.slice(0, 4), 10);
  const endYear = Number.parseInt(endDate.slice(0, 4), 10);

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
