import { NextResponse } from "next/server";
import { deleteCampaign } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    deleteCampaign(id);

    return NextResponse.json({
      ok: true,
      id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "체험단 삭제 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}

