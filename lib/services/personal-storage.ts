import "server-only";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import type { Actor } from "@/lib/auth/server";
import { encryptSecret } from "@/lib/crypto";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { ensureUser } from "@/lib/services/provisioning";

export async function personalDriveUser(actor: Actor) {
  const user = await ensureUser(actor);
  const [root, profile] = await Promise.all([
    db.storageRoot.findUnique({ where: { ownerUserId: user.id } }),
    db.credentialProfile.findUnique({ where: { ownerUserId: user.id } }),
  ]);
  return { user, root, profile };
}

export async function assertPersonalDriveCanConnect(user: User, personalRootId?: string) {
  if (user.storageRootId === personalRootId && personalRootId) return;
  const [trips, files, uploads] = await Promise.all([
    db.trip.count({ where: { userId: user.id } }),
    db.mediaFile.count({ where: { userId: user.id } }),
    db.uploadSession.count({ where: { userId: user.id } }),
  ]);
  if (trips || files || uploads) {
    throw new Response("Existing trips use another storage root. Contact an administrator before switching to personal Drive storage.", { status: 409 });
  }
}

export async function connectPersonalDrive(actor: Actor, tokens: object, email: string, displayName?: string) {
  const { user, root: existingRoot, profile: existingProfile } = await personalDriveUser(actor);
  await assertPersonalDriveCanConnect(user, existingRoot?.id);
  if (existingProfile?.googleAccountEmail && existingProfile.googleAccountEmail !== email) {
    throw new Response("Reconnect the same Google account already used for your TripNest storage.", { status: 409 });
  }
  const profile = await db.credentialProfile.upsert({
    where: { ownerUserId: user.id },
    create: { ownerUserId: user.id, name: displayName ? `${displayName} Drive` : "Personal Google Drive", type: "OAUTH", googleAccountEmail: email, encryptedCredentials: encryptSecret(JSON.stringify(tokens)) },
    update: { name: displayName ? `${displayName} Drive` : "Personal Google Drive", type: "OAUTH", googleAccountEmail: email, encryptedCredentials: encryptSecret(JSON.stringify(tokens)), revokedAt: null },
  });
  const drive = await driveFor(profile);
  const folder = existingRoot
    ? await drive.inspectFolder(existingRoot.googleFolderId)
    : await drive.createFolder("root", "TripNest", { tripnestPersonalOwnerId: user.id });
  if (!folder.writable) throw new Response("This Google Drive folder is not writable.", { status: 409 });
  const probe = await drive.createFolder(folder.id, ".tripnest-health-check", { tripnestHealthCheck: randomUUID() });
  await drive.deleteFile(probe.id);

  await db.$transaction(async (tx) => {
    const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (fresh.storageRootId !== existingRoot?.id || !existingRoot) {
      const hasTrips = await tx.trip.count({ where: { userId: user.id } });
      const hasFiles = await tx.mediaFile.count({ where: { userId: user.id } });
      const hasUploads = await tx.uploadSession.count({ where: { userId: user.id } });
      if (hasTrips || hasFiles || hasUploads) throw new Response("Existing trips use another storage root. Contact an administrator before switching to personal Drive storage.", { status: 409 });
    }
    const root = await tx.storageRoot.upsert({
      where: { ownerUserId: user.id },
      create: { ownerUserId: user.id, displayName: "Personal Google Drive", googleFolderId: folder.id, folderUrl: `https://drive.google.com/drive/folders/${folder.id}`, storageType: folder.storageType, credentialProfileId: profile.id, enabled: true, writable: true, priority: 0, assignedUserCount: 1, lastHealthStatus: "HEALTHY", lastHealthCheckedAt: new Date(), lastHealthMessage: "Personal Drive connection verified" },
      update: { credentialProfileId: profile.id, enabled: true, writable: true, lastHealthStatus: "HEALTHY", lastHealthCheckedAt: new Date(), lastHealthMessage: "Personal Drive connection verified" },
    });
    if (fresh.storageRootId !== root.id) {
      if (fresh.storageRootId) await tx.storageRoot.updateMany({ where: { id: fresh.storageRootId, assignedUserCount: { gt: 0 } }, data: { assignedUserCount: { decrement: 1 } } });
      await tx.user.update({ where: { id: user.id }, data: { storageRootId: root.id, driveFolderId: null, provisioningState: "PENDING", provisioningStartedAt: null, provisioningError: null } });
    }
  });
}
