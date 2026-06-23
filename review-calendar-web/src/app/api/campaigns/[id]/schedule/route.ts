import { NextResponse } from "next/server";
import { clearCampaignSchedule, updateCampaignSchedule } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { selectedDate?: string };

    if (body.selectedDate === null) {
      clearCampaignSchedule(id);
      return NextResponse.json({
        ok: true,
        selectedDate: null,
      });
    }

    if (!body.selectedDate) {
      return NextResponse.json(
        { message: "확정할 날짜 정보가 없어요." },
        { status: 400 },
      );
    }

    updateCampaignSchedule(id, body.selectedDate);

    return NextResponse.json({
      ok: true,
      selectedDate: body.selectedDate,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "일정 확정 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
