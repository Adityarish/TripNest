import "server-only";
import { env, isLocalMode } from "@/lib/env";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { driveFor } from "@/lib/drive";
import { extractDriveFolderId } from "@/lib/validation/schemas";
import { safeStorageError } from "@/lib/storage-errors";
import { randomUUID } from "node:crypto";

async function retireLocalMockStorage() {
  if (isLocalMode) return;

  const mockRoots = await db.storageRoot.findMany({
    where: { storageType: "MOCK" },
    select: { id: true },
  });
  if (!mockRoots.length) return;

  const mockRootIds = mockRoots.map(({ id }) => id);
  await db.storageRoot.updateMany({
    where: { id: { in: mockRootIds } },
    data: {
      enabled: false,
      writable: false,
      lastHealthStatus: "UNAVAILABLE",
      lastHealthCheckedAt: new Date(),
      lastHealthMessage: "Local demo storage was retired after Google Drive was enabled",
    },
  });

  // A user who only signed in during local setup has no data to migrate. Release
  // that empty assignment so normal provisioning can place them on Google Drive.
  const emptyMockUsers = await db.user.findMany({
    where: {
      storageRootId: { in: mockRootIds },
      trips: { none: {} },
      files: { none: {} },
      uploads: { none: {} },
    },
    select: { id: true },
  });
  if (emptyMockUsers.length) {
    await db.user.updateMany({
      where: { id: { in: emptyMockUsers.map(({ id }) => id) } },
      data: {
        storageRootId: null,
        driveFolderId: null,
        provisioningState: "PENDING",
        provisioningStartedAt: null,
        provisioningError: null,
      },
    });
  }

  for (const { id } of mockRoots) {
    const assignedUserCount = await db.user.count({ where: { storageRootId: id } });
    await db.storageRoot.update({ where: { id }, data: { assignedUserCount } });
  }

  // Remove an unused demo root so the admin screen shows only real storage.
  await db.storageRoot.deleteMany({
    where: {
      id: { in: mockRootIds },
      users: { none: {} },
      sourceMigrations: { none: {} },
      destinationMigrations: { none: {} },
    },
  });
}

export async function syncEnvironmentStorageRoots() {
  await retireLocalMockStorage();
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64) {
    const raw = Buffer.from(env.GOOGLE_SERVICE_ACCOUNT_JSON_BASE64, "base64").toString("utf8");
    const serviceAccount = JSON.parse(raw) as { client_email?: string };
    if (!serviceAccount.client_email) throw new Error("Service-account JSON has no client email");
    const existing = await db.credentialProfile.findFirst({ where: { ownerUserId: null, type: "SERVICE_ACCOUNT", googleAccountEmail: serviceAccount.client_email } });
    if (existing) await db.credentialProfile.update({ where: { id: existing.id }, data: { encryptedCredentials: encryptSecret(raw), revokedAt: null } });
    else await db.credentialProfile.create({ data: { name: "Workspace service account", type: "SERVICE_ACCOUNT", googleAccountEmail: serviceAccount.client_email, encryptedCredentials: encryptSecret(raw) } });
  }
  const urls = [1, 2, 3, 4, 5].map((index) => ({ index, url: process.env[`GOOGLE_DRIVE_ROOT_${index}_URL`] }))
    .filter((entry): entry is { index: number; url: string } => Boolean(entry.url));
  if (!urls.length) return;
  const profiles = await db.credentialProfile.findMany({ where: { ownerUserId: null, revokedAt: null, type: { in: ["OAUTH", "SERVICE_ACCOUNT"] } }, orderBy: { createdAt: "asc" } });
  for (const { index, url } of urls) {
    const folderId = extractDriveFolderId(url);
    if (await db.storageRoot.findUnique({ where: { googleFolderId: folderId } })) continue;
    if (await db.storageRoot.count({ where: { ownerUserId: null, storageType: { not: "MOCK" } } }) >= 5) {
      throw new Error("TripNest supports at most five configured Google Drive roots");
    }
    for (const profile of profiles) {
      try {
        const drive = await driveFor(profile);
        const info = await drive.inspectFolder(folderId);
        if (!info.writable) continue;
        let verified = false;
        let healthMessage = "Configured folder is not writable";
        try {
          const probe = await drive.createFolder(folderId, ".tripnest-health-check", { tripnestHealthCheck: randomUUID() });
          await drive.deleteFile(probe.id);
          verified = true;
          healthMessage = "Loaded and verified from environment";
        } catch (error) { healthMessage = safeStorageError(error); }
        await db.storageRoot.create({ data: { displayName: `Storage Root ${index}`, googleFolderId: folderId, folderUrl: url, storageType: info.storageType, credentialProfileId: profile.id, enabled: verified, writable: verified, priority: index, lastHealthStatus: verified ? "HEALTHY" : "DEGRADED", lastHealthCheckedAt: new Date(), lastHealthMessage: healthMessage } });
        break;
      } catch {
        // A different connected account may own this configured root.
      }
    }
  }
}
