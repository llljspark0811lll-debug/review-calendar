import { NextResponse } from "next/server";
import { hasGangnamSession } from "@/lib/gangnam/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const connected = await hasGangnamSession();
    return NextResponse.json({ connected });
  } catch {
    return NextResponse.json({ connected: false }, { status: 200 });
  }
}
