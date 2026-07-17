import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findCampaignById, updateCampaignStatus } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";
import type { CampaignStatus } from "@/types/campaign";

export const runtime = "nodejs";

const allowedTransitions: Partial<Record<CampaignStatus, CampaignStatus[]>> = {
  scheduled: ["completed"],
  completed: ["scheduled", "review_submitted"],
  review_submitted: ["completed"],
};

function isCampaignStatus(value: unknown): value is CampaignStatus {
  return (
    value === "unscheduled" ||
    value === "scheduled" ||
    value === "completed" ||
    value === "review_submitted"
  );
}

function transitionMessage(from: CampaignStatus, to: CampaignStatus) {
  if (from === "unscheduled") {
    return "\ub0a0\uc9dc \ubbf8\uc815 \uccb4\ud5d8\ub2e8\uc740 \uba3c\uc800 \uc77c\uc815\uc744 \ud655\uc815\ud574 \uc8fc\uc138\uc694.";
  }

  if (to === "unscheduled") {
    return "\ud655\uc815 \ucde8\uc18c\ub294 \uc77c\uc815 API\ub97c \ud1b5\ud574 \ucc98\ub9ac\ud574 \uc8fc\uc138\uc694.";
  }

  return "\ud604\uc7ac \uc0c1\ud0dc\uc5d0\uc11c\ub294 \uc694\uccad\ud55c \uc0c1\ud0dc\ub85c \ubcc0\uacbd\ud560 \uc218 \uc5c6\uc5b4\uc694.";
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const { id } = await context.params;
    const body = (await request.json()) as { status?: unknown };

    if (!isCampaignStatus(body.status)) {
      return NextResponse.json(
        {
          message:
            "\ubcc0\uacbd\ud560 \uc0c1\ud0dc \uc815\ubcf4\uac00 \uc62c\ubc14\ub974\uc9c0 \uc54a\uc544\uc694.",
        },
        { status: 400 },
      );
    }

    const campaign = await findCampaignById(id, user.id);

    if (!campaign) {
      return NextResponse.json(
        {
          message:
            "\uccb4\ud5d8\ub2e8 \uc815\ubcf4\ub97c \ucc3e\uc9c0 \ubabb\ud588\uc5b4\uc694.",
        },
        { status: 404 },
      );
    }

    const nextStatus = body.status;
    const allowedNextStatuses = allowedTransitions[campaign.status] ?? [];

    if (!allowedNextStatuses.includes(nextStatus)) {
      return NextResponse.json(
        { message: transitionMessage(campaign.status, nextStatus) },
        { status: 400 },
      );
    }

    await updateCampaignStatus(id, nextStatus, user.id);

    return NextResponse.json({
      ok: true,
      status: nextStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "\uc0c1\ud0dc \ubcc0\uacbd \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc5b4\uc694.") },
      { status: 400 },
    );
  }
}
