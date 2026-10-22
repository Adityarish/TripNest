import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { apiError } from "@/lib/http";
import { safeStorageError } from "@/lib/storage-errors";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ rootId: string }> }) {
  const id = (await params).rootId;
  let authorizedRoot = false;
  try {
    await requireAdmin();
    const root = await db.storageRoot.findUniqueOrThrow({ where: { id }, include: { credentialProfile: true } });
    if (root.ownerUserId) return NextResponse.json({ error: "Storage root not found" }, { status: 404 });
    authorizedRoot = true;
    const drive = await driveFor(root.credentialProfile);
    const info = await drive.inspectFolder(root.googleFolderId);
    const probe = await drive.createFolder(root.googleFolderId, ".tripnest-health-check", { tripnestHealthCheck: root.id });
    await drive.deleteFile(probe.id);
    const updated = await db.storageRoot.update({ where: { id }, data: { storageType: info.storageType, writable: true, lastHealthStatus: "HEALTHY", lastHealthCheckedAt: new Date(), lastHealthMessage: "Read and write access verified" } });
    return NextResponse.json(updated);
  } catch (error) {
    if (authorizedRoot) await db.storageRoot.updateMany({ where: { id, ownerUserId: null }, data: { writable: false, lastHealthStatus: "UNAVAILABLE", lastHealthCheckedAt: new Date(), lastHealthMessage: safeStorageError(error) } });
    return apiError(error);
  }
}
