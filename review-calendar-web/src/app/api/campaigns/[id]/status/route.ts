import { NextResponse } from "next/server";
import { updateCampaignStatus } from "@/lib/db";
import type { CampaignStatus } from "@/types/campaign";

export const runtime = "nodejs";

const allowedStatuses: CampaignStatus[] = [
  "scheduled",
  "completed",
  "review_submitted",
];

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { status?: CampaignStatus };

    if (!body.status || !allowedStatuses.includes(body.status)) {
      return NextResponse.json(
        { message: "변경할 상태 정보가 올바르지 않아요." },
        { status: 400 },
      );
    }

    updateCampaignStatus(id, body.status);

    return NextResponse.json({
      ok: true,
      status: body.status,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "상태 변경 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
