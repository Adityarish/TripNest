import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

const decisionInput = z.object({
  decision: z.enum(["APPROVED", "DECLINED"]),
  googleTestUserAdded: z.boolean().optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const admin = await requireAdmin();
    const input = decisionInput.parse(await request.json());
    if (input.decision === "APPROVED" && input.googleTestUserAdded !== true) {
      throw new Response("Add this email to Google Auth Platform test users before approving", { status: 409 });
    }
    const requestId = (await params).requestId;
    const result = await db.$transaction(async (tx) => {
      const access = await tx.driveAccessRequest.findUnique({ where: { id: requestId }, include: { user: { select: { active: true, deletedAt: true } } } });
      if (!access) throw new Response("Request not found", { status: 404 });
      if (!access.user.active || access.user.deletedAt) throw new Response("This account is inactive", { status: 409 });
      if (access.status !== "PENDING") throw new Response("This request has already been reviewed", { status: 409 });
      const changed = await tx.driveAccessRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: input.decision, reviewedBy: admin.clerkUserId, reviewedAt: new Date() },
      });
      if (changed.count !== 1) throw new Response("This request has already been reviewed", { status: 409 });
      await tx.notification.create({ data: {
        userId: access.userId,
        title: input.decision === "APPROVED" ? "Google Drive access approved" : "Google Drive access declined",
        body: input.decision === "APPROVED"
          ? `Your request for ${access.googleEmail} was approved. You can now connect that Google Drive account.`
          : `Your request for ${access.googleEmail} was declined. You can submit a new request from My Drive.`,
        href: "/storage",
      } });
      return input.decision;
    });
    return NextResponse.json({ status: result });
  } catch (error) { return apiError(error); }
}
