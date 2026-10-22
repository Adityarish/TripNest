import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { rootInput, extractDriveFolderId } from "@/lib/validation/schemas";
import { apiError } from "@/lib/http";
import { safeStorageError } from "@/lib/storage-errors";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    const [roots, profiles] = await Promise.all([
      db.storageRoot.findMany({ where: { ownerUserId: null }, include: { credentialProfile: { select: { id: true, name: true, type: true, googleAccountEmail: true, revokedAt: true } } }, orderBy: [{ priority: "asc" }, { id: "asc" }] }),
      db.credentialProfile.findMany({ where: { ownerUserId: null }, select: { id: true, name: true, type: true, googleAccountEmail: true, revokedAt: true }, orderBy: { createdAt: "desc" } }),
    ]);
    return NextResponse.json({ roots, profiles });
  } catch (error) { return apiError(error); }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const input = rootInput.parse(await request.json());
    if (await db.storageRoot.count({ where: { ownerUserId: null, storageType: { not: "MOCK" } } }) >= 5) return NextResponse.json({ error: "TripNest supports at most five configured Google Drive roots" }, { status: 409 });
    const profile = await db.credentialProfile.findUniqueOrThrow({ where: { id: input.credentialProfileId } });
    if (profile.ownerUserId) return NextResponse.json({ error: "Personal Drive credentials cannot be used for shared roots" }, { status: 403 });
    if (profile.revokedAt) return NextResponse.json({ error: "Reconnect this credential before assigning a root" }, { status: 409 });
    const folderId = extractDriveFolderId(input.folderUrl);
    const drive = await driveFor(profile);
    const info = await drive.inspectFolder(folderId);
    let verified = false;
    let healthMessage = "Folder is readable but not writable";
    if (info.writable) {
      try {
        const probe = await drive.createFolder(folderId, ".tripnest-health-check", { tripnestHealthCheck: randomUUID() });
        await drive.deleteFile(probe.id);
        verified = true;
        healthMessage = "Read and write access verified";
      } catch (error) { healthMessage = safeStorageError(error); }
    }
    const root = await db.storageRoot.create({ data: {
      displayName: input.displayName, folderUrl: input.folderUrl, googleFolderId: folderId, storageType: info.storageType,
      credentialProfileId: profile.id, enabled: input.enabled && verified, writable: verified, priority: input.priority,
      lastHealthStatus: verified ? "HEALTHY" : "DEGRADED", lastHealthCheckedAt: new Date(), lastHealthMessage: healthMessage,
    } });
    return NextResponse.json(root, { status: 201 });
  } catch (error) { return apiError(error); }
}
