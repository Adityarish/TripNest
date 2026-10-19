import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isLocalMode } from "@/lib/env";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "connected", provider: isLocalMode ? "local-demo" : "clerk-google" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
