import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteCampaign } from "@/lib/db";
import { toClientMessage } from "@/lib/errors";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const { id } = await context.params;
    await deleteCampaign(id, user.id);

    return NextResponse.json({
      ok: true,
      id,
    });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "체험단 삭제 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
