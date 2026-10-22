import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { ensureUser } from "@/lib/services/provisioning";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ notificationId: string }> }) {
  try {
    const user = await ensureUser(await requireActor());
    const updated = await db.notification.updateMany({
      where: { id: (await params).notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: updated.count > 0 });
  } catch (error) { return apiError(error); }
}
