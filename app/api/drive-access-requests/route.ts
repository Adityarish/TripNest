import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin, requireActor } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { ensureUser } from "@/lib/services/provisioning";

export const runtime = "nodejs";

const requestInput = z.object({ googleEmail: z.string().trim().email().transform((email) => email.toLowerCase()) });

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor();
    if (isAdmin(actor.clerkUserId)) throw new Response("Admin accounts do not need personal Drive access approval", { status: 403 });
    const user = await ensureUser(actor);
    const { googleEmail } = requestInput.parse(await request.json());
    const profile = await db.credentialProfile.findUnique({ where: { ownerUserId: user.id } });
    if (profile?.googleAccountEmail && profile.googleAccountEmail.toLowerCase() !== googleEmail) {
      throw new Response("Reconnect the Google account already used for your TripNest storage", { status: 409 });
    }
    const current = await db.driveAccessRequest.findUnique({ where: { userId: user.id } });
    if (current?.googleEmail === googleEmail && current.status !== "DECLINED") {
      return NextResponse.json({ status: current.status });
    }
    const saved = await db.driveAccessRequest.upsert({
      where: { userId: user.id },
      create: { userId: user.id, googleEmail },
      update: { googleEmail, status: "PENDING", reviewedAt: null, reviewedBy: null },
    });
    return NextResponse.json({ status: saved.status }, { status: current ? 200 : 201 });
  } catch (error) { return apiError(error); }
}
