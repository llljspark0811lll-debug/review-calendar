import { NextResponse } from "next/server";
import { isValidUsername, normalizeUsername } from "@/lib/auth";
import { findUserByUsername } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = normalizeUsername(searchParams.get("username") ?? "");

  if (!isValidUsername(username)) {
    return NextResponse.json(
      {
        available: false,
        message: "아이디는 영문 소문자, 숫자, 밑줄로 4-20자 입력해 주세요.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    available: !(await findUserByUsername(username)),
  });
}
