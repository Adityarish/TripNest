import "server-only";
import { randomUUID } from "node:crypto";
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

export async function connectPersonalDrive(actor: Actor, tokens: object, email: string, displayName?: string) {
  const { user, root: existingRoot, profile: existingProfile } = await personalDriveUser(actor);
  if (existingProfile?.googleAccountEmail && existingProfile.googleAccountEmail.toLowerCase() !== email.toLowerCase()) {
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

  await db.storageRoot.upsert({
    where: { ownerUserId: user.id },
    create: { ownerUserId: user.id, displayName: "Personal Google Drive", googleFolderId: folder.id, folderUrl: `https://drive.google.com/drive/folders/${folder.id}`, storageType: folder.storageType, credentialProfileId: profile.id, enabled: true, writable: true, priority: 0, assignedUserCount: 0, lastHealthStatus: "HEALTHY", lastHealthCheckedAt: new Date(), lastHealthMessage: "Personal Drive connection verified" },
    update: { credentialProfileId: profile.id, enabled: true, writable: true, lastHealthStatus: "HEALTHY", lastHealthCheckedAt: new Date(), lastHealthMessage: "Personal Drive connection verified" },
  });
}
