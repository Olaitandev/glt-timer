import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  return NextResponse.json({
    now: now.toISOString(),
    now_ms: now.getTime(),
  });
}
