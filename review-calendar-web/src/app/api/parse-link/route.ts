import { NextResponse } from "next/server";
import { parseCampaignLink } from "@/lib/parsers";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json(
        { message: "링크가 비어 있어요." },
        { status: 400 },
      );
    }

    const parsed = await parseCampaignLink(body.url);
    return NextResponse.json(parsed);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "링크 파싱 중 오류가 발생했어요.",
      },
      { status: 400 },
    );
  }
}
