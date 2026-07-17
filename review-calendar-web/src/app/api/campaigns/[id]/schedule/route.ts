import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  clearCampaignSchedule,
  findCampaignById,
  updateCampaignSchedule,
} from "@/lib/db";
import { toClientMessage } from "@/lib/errors";

export const runtime = "nodejs";

function isDateWithinExperienceRange(
  selectedDate: string,
  campaign: {
    experienceStartDate: string;
    experienceEndDate: string;
  },
) {
  const selectedDay = selectedDate.slice(0, 10);

  return (
    selectedDay >= campaign.experienceStartDate &&
    selectedDay <= campaign.experienceEndDate
  );
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
    const body = (await request.json()) as { selectedDate?: string | null };
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

    if (body.selectedDate === null) {
      if (campaign.status !== "scheduled") {
        return NextResponse.json(
          {
            message:
              "\ud655\uc815\ub41c \uccb4\ud5d8\ub2e8\ub9cc \ud655\uc815 \ucde8\uc18c\ud560 \uc218 \uc788\uc5b4\uc694.",
          },
          { status: 400 },
        );
      }

      await clearCampaignSchedule(id, user.id);
      return NextResponse.json({
        ok: true,
        selectedDate: null,
      });
    }

    if (!body.selectedDate) {
      return NextResponse.json(
        {
          message:
            "\ud655\uc815\ud560 \ub0a0\uc9dc \uc815\ubcf4\uac00 \uc5c6\uc5b4\uc694.",
        },
        { status: 400 },
      );
    }

    if (campaign.status !== "unscheduled") {
      return NextResponse.json(
        {
          message:
            "\ub0a0\uc9dc \ubbf8\uc815 \uc0c1\ud0dc\uc758 \uccb4\ud5d8\ub2e8\ub9cc \uc77c\uc815\uc744 \ud655\uc815\ud560 \uc218 \uc788\uc5b4\uc694.",
        },
        { status: 400 },
      );
    }

    if (!isDateWithinExperienceRange(body.selectedDate, campaign)) {
      return NextResponse.json(
        {
          message:
            "\uccb4\ud5d8 \uac00\ub2a5 \uae30\uac04 \uc548\uc5d0\uc11c \ub0a0\uc9dc\ub97c \uc120\ud0dd\ud574 \uc8fc\uc138\uc694.",
        },
        { status: 400 },
      );
    }

    await updateCampaignSchedule(id, body.selectedDate, user.id);

    return NextResponse.json({
      ok: true,
      selectedDate: body.selectedDate,
    });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "\uc77c\uc815 \ud655\uc815 \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc5b4\uc694.") },
      { status: 400 },
    );
  }
}
