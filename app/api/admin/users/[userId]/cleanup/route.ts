import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin();
    const user = await db.user.findUnique({ where: { id: (await params).userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    if (user.active || !user.deletedAt) return NextResponse.json({ error: "Cleanup is restricted to users deleted through a verified Clerk webhook" }, { status: 409 });
    if (!user.storageRootId || !user.driveFolderId) return NextResponse.json({ ok: true, alreadyClean: true });
    const root = await db.storageRoot.findUniqueOrThrow({ where: { id: user.storageRootId }, include: { credentialProfile: true } });
    await driveFor(root.credentialProfile).then((drive) => drive.deleteFile(user.driveFolderId!));
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { driveFolderId: null, storageRootId: null, provisioningState: "FAILED", provisioningError: "Originals removed by explicit administrator cleanup" } }),
      db.storageRoot.update({ where: { id: root.id }, data: { assignedUserCount: { decrement: 1 } } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
