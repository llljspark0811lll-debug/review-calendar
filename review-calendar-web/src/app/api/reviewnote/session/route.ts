import { NextResponse } from "next/server";
import { hasReviewNoteSession } from "@/lib/review-note/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const connected = await hasReviewNoteSession();
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
