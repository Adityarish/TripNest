import { notFound } from "next/navigation";
import { isAdmin, requireActor } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { jsonSafe } from "@/lib/utils";
import { DriveAccessRequestsAdmin } from "@/components/drive-access-requests-admin";

export const dynamic = "force-dynamic";

export default async function DriveAccessAdminPage() {
  const actor = await requireActor();
  if (!isAdmin(actor.clerkUserId)) notFound();
  const requests = await db.driveAccessRequest.findMany({
    where: { status: "PENDING" },
    include: { user: { select: { displayName: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });
  return <div className="mx-auto max-w-3xl"><DriveAccessRequestsAdmin requests={jsonSafe(requests)} /></div>;
}
