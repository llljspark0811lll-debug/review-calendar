import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasReviewNoteSession } from "@/lib/review-note/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    const connected = await hasReviewNoteSession(user.id);
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
