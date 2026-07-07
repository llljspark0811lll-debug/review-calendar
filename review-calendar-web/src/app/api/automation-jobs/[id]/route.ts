import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { findAutomationJobById } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
  }

  const { id } = await context.params;
  const job = await findAutomationJobById(id, user.id);

  if (!job) {
    return NextResponse.json(
      { message: "작업 정보를 찾지 못했어요." },
      { status: 404 },
    );
  }

  return NextResponse.json({ job });
}
