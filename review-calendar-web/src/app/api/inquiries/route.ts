import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { toClientMessage, UserFacingError } from "@/lib/errors";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

const inquiryTypeLabels = {
  usage: "사용방법 문의",
  feature: "기능 추가 요구",
  bug: "버그 제보",
  etc: "기타",
} as const;

type InquiryType = keyof typeof inquiryTypeLabels;

function isInquiryType(value: unknown): value is InquiryType {
  return typeof value === "string" && value in inquiryTypeLabels;
}

async function sendInquiryEmail(input: {
  type: InquiryType;
  message: string;
  username: string;
  email: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const to = process.env.INQUIRY_TO_EMAIL;

  if (!apiKey || !from || !to) {
    console.info(
      `[inquiry] ${input.username}(${input.email}) - ${inquiryTypeLabels[input.type]}: ${input.message}`,
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: input.email,
      subject: `[리뷰캘린더 문의] ${inquiryTypeLabels[input.type]}`,
      text: `아이디: ${input.username}\n이메일: ${input.email}\n문의 유형: ${inquiryTypeLabels[input.type]}\n\n${input.message}`,
    }),
  });

  if (!response.ok) {
    throw new UserFacingError("문의 발송에 실패했어요.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ message: "로그인이 필요해요." }, { status: 401 });
    }

    const body = (await request.json()) as { type?: unknown; message?: unknown };

    if (!isInquiryType(body.type)) {
      return NextResponse.json(
        { message: "문의 유형을 선택해 주세요." },
        { status: 400 },
      );
    }

    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json(
        { message: "문의 내용을 입력해 주세요." },
        { status: 400 },
      );
    }

    if (message.length > 2000) {
      return NextResponse.json(
        { message: "문의 내용은 2000자 이내로 입력해 주세요." },
        { status: 400 },
      );
    }

    await sendInquiryEmail({
      type: body.type,
      message,
      username: user.username,
      email: user.email,
    });
    await sendTelegramMessage(
      `📩 문의/요청 [${inquiryTypeLabels[body.type]}]\n아이디: ${user.username}\n이메일: ${user.email}\n\n${message}`,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: toClientMessage(error, "문의 접수 중 오류가 발생했어요.") },
      { status: 400 },
    );
  }
}
