import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { apiError } from "@/lib/http";
import { createTrip, listTrips } from "@/lib/services/trips";
import { tripInput } from "@/lib/validation/schemas";
import { jsonSafe } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json(jsonSafe(await listTrips(await requireActor()))); }
  catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    const trip = await createTrip(await requireActor(), tripInput.parse(await request.json()));
    return NextResponse.json(jsonSafe(trip), { status: 201 });
  } catch (error) { return apiError(error); }
}
