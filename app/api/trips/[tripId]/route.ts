import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { apiError } from "@/lib/http";
import { getTrip } from "@/lib/services/trips";
import { jsonSafe } from "@/lib/utils";
import { db } from "@/lib/db";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const actor = await requireActor();
    const trip = await getTrip(actor, (await params).tripId);
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    return NextResponse.json(jsonSafe(trip));
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ tripId: string }> }) {
  try {
    const actor = await requireActor();
    const existing = await getTrip(actor, (await params).tripId);
    if (!existing) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    const input = z.object({
      coverFileId: z.string().uuid().nullable().optional(),
      isFavorite: z.boolean().optional(),
    }).refine((value) => value.coverFileId !== undefined || value.isFavorite !== undefined, "At least one change is required").parse(await request.json());
    if (input.coverFileId && !existing.files.some((file) => file.id === input.coverFileId && file.category === "PHOTOS")) {
      return NextResponse.json({ error: "Cover must be a photo from this trip" }, { status: 400 });
    }
    return NextResponse.json(await db.trip.update({ where: { id: existing.id }, data: input }));
  } catch (error) { return apiError(error); }
}
