import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { apiError } from "@/lib/http";

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const input = z.object({ userId: z.string().uuid(), destinationRootId: z.string().uuid() }).parse(await request.json());
    const user = await db.user.findUniqueOrThrow({ where: { id: input.userId } });
    if (!user.storageRootId || !user.driveFolderId) return NextResponse.json({ error: "User storage is not ready" }, { status: 409 });
    if (await db.rootMigration.findFirst({ where: { userId: user.id, state: { in: ["COPYING", "VERIFYING"] } } })) return NextResponse.json({ error: "This user already has a migration in progress or requiring review" }, { status: 409 });
    if (user.storageRootId === input.destinationRootId) return NextResponse.json({ error: "User is already assigned to this root" }, { status: 409 });
    const [source, destination] = await Promise.all([
      db.storageRoot.findUniqueOrThrow({ where: { id: user.storageRootId }, include: { credentialProfile: true } }),
      db.storageRoot.findUniqueOrThrow({ where: { id: input.destinationRootId }, include: { credentialProfile: true } }),
    ]);
    if (source.ownerUserId || destination.ownerUserId) return NextResponse.json({ error: "Personal Drive roots cannot be used in shared-root migrations" }, { status: 409 });
    if (!destination.enabled || !destination.writable) return NextResponse.json({ error: "Destination root is not enabled and writable" }, { status: 409 });
    const sourceDrive = await driveFor(source.credentialProfile);
    const destinationDrive = await driveFor(destination.credentialProfile);
    const destinationAccess = await sourceDrive.inspectFolder(destination.googleFolderId);
    if (!destinationAccess.writable) return NextResponse.json({ error: "Source credential cannot write to the destination root" }, { status: 409 });
    const migration = await db.rootMigration.create({ data: { userId: user.id, sourceRootId: source.id, destinationRootId: destination.id, requestedBy: admin.clerkUserId, state: "COPYING" } });
    let moved = false;
    try {
      // A source account may move into a root assigned to another profile when that
      // destination folder is also shared with the source account. This preserves
      // provider-side originals and avoids a lossy download/re-upload relay.
      await sourceDrive.moveFile(user.driveFolderId, source.googleFolderId, destination.googleFolderId);
      moved = true;
      const userFolder = await destinationDrive.inspectFolder(user.driveFolderId);
      if (!userFolder.writable) throw new Error("Destination credential cannot write to the moved user folder");
      await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { storageRootId: destination.id } }),
        db.storageRoot.update({ where: { id: source.id }, data: { assignedUserCount: { decrement: 1 } } }),
        db.storageRoot.update({ where: { id: destination.id }, data: { assignedUserCount: { increment: 1 } } }),
        db.rootMigration.update({ where: { id: migration.id }, data: { state: "COMPLETED" } }),
      ]);
      return NextResponse.json({ id: migration.id, state: "COMPLETED" });
    } catch (error) {
      let rollbackFailed = false;
      if (moved) {
        try { await sourceDrive.moveFile(user.driveFolderId, destination.googleFolderId, source.googleFolderId); }
        catch { rollbackFailed = true; }
      }
      await db.rootMigration.update({ where: { id: migration.id }, data: {
        state: rollbackFailed ? "VERIFYING" : "FAILED",
        errorMessage: rollbackFailed ? "Drive move succeeded but recovery failed. Check both roots and reconcile before allowing access." : "Migration failed; original root assignment was preserved.",
      } });
      throw error;
    }
  } catch (error) { return apiError(error); }
}
