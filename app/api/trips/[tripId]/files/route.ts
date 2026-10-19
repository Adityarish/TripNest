import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { getTrip } from "@/lib/services/trips";
import { apiError } from "@/lib/http";
import { jsonSafe } from "@/lib/utils";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const trip = await getTrip(await requireActor(), (await params).tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    return NextResponse.json(jsonSafe(trip.files));
  } catch (error) { return apiError(error); }
}
