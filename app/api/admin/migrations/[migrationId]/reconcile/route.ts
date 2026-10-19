import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ migrationId: string }> }) {
  try {
    await requireAdmin();
    const migration = await db.rootMigration.findUnique({
      where: { id: (await params).migrationId },
      include: { user: true, sourceRoot: { include: { credentialProfile: true } }, destinationRoot: { include: { credentialProfile: true } } },
    });
    if (!migration) return NextResponse.json({ error: "Migration not found" }, { status: 404 });
    if (migration.state !== "VERIFYING" || !migration.user.driveFolderId || migration.user.storageRootId !== migration.sourceRootId) {
      return NextResponse.json({ error: "Migration cannot be reconciled in its current state" }, { status: 409 });
    }
    const properties = { tripnestUserId: migration.userId };
    const [sourceFolder, destinationFolder] = await Promise.all([
      driveFor(migration.sourceRoot.credentialProfile).then((drive) => drive.findFolder(migration.sourceRoot.googleFolderId, properties)),
      driveFor(migration.destinationRoot.credentialProfile).then((drive) => drive.findFolder(migration.destinationRoot.googleFolderId, properties)),
    ]);
    const sourceMatches = sourceFolder?.id === migration.user.driveFolderId;
    const destinationMatches = destinationFolder?.id === migration.user.driveFolderId;
    if (sourceMatches === destinationMatches) return NextResponse.json({ error: "Folder location is ambiguous. Inspect both Drive roots before retrying." }, { status: 409 });
    if (sourceMatches) {
      await db.rootMigration.update({ where: { id: migration.id }, data: { state: "FAILED", errorMessage: "Folder confirmed at original root; assignment unchanged" } });
      return NextResponse.json({ state: "FAILED", location: "source" });
    }
    if (!destinationFolder?.writable) return NextResponse.json({ error: "Destination credential cannot write to the user folder" }, { status: 409 });
    await db.$transaction([
      db.user.update({ where: { id: migration.userId }, data: { storageRootId: migration.destinationRootId } }),
      db.storageRoot.update({ where: { id: migration.sourceRootId }, data: { assignedUserCount: { decrement: 1 } } }),
      db.storageRoot.update({ where: { id: migration.destinationRootId }, data: { assignedUserCount: { increment: 1 } } }),
      db.rootMigration.update({ where: { id: migration.id }, data: { state: "COMPLETED", errorMessage: "Folder confirmed at destination root" } }),
    ]);
    return NextResponse.json({ state: "COMPLETED", location: "destination" });
  } catch (error) { return apiError(error); }
}
