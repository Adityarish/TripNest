import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";
import { Prisma } from "@prisma/client";

type ClerkEvent = {
  id: string;
  type: "user.created" | "user.updated" | "user.deleted";
  data: { id: string; first_name?: string; last_name?: string; image_url?: string; email_addresses?: Array<{ id: string; email_address: string }>; primary_email_address_id?: string };
};

export async function POST(request: NextRequest) {
  try {
    if (!env.CLERK_WEBHOOK_SECRET) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
    const payload = await request.text();
    new Webhook(env.CLERK_WEBHOOK_SECRET).verify(payload, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
    const event = JSON.parse(payload) as ClerkEvent;
    const alreadyProcessed = await db.webhookEvent.findUnique({ where: { id: event.id } });
    if (alreadyProcessed) return NextResponse.json({ ok: true, duplicate: true });
    try {
      await db.$transaction(async (tx) => {
        // Insert first so concurrent deliveries cannot both apply the same event.
        await tx.webhookEvent.create({ data: { id: event.id, type: event.type } });
        if (event.type === "user.deleted") {
          await tx.user.upsert({
            where: { clerkUserId: event.data.id },
            update: { active: false, deletedAt: new Date() },
            create: { clerkUserId: event.data.id, active: false, deletedAt: new Date() },
          });
        } else {
          const email = event.data.email_addresses?.find((item) => item.id === event.data.primary_email_address_id)?.email_address;
          await tx.user.upsert({
            where: { clerkUserId: event.data.id },
            // A delayed update must never reactivate a deleted account.
            update: { email, displayName: [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || undefined, avatarUrl: event.data.image_url },
            create: { clerkUserId: event.data.id, email, displayName: [event.data.first_name, event.data.last_name].filter(Boolean).join(" ") || undefined, avatarUrl: event.data.image_url },
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && await db.webhookEvent.findUnique({ where: { id: event.id } })) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
