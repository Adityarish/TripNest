import "server-only";
import { Prisma, type User } from "@prisma/client";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { isLocalMode } from "@/lib/env";
import { tripFolderName } from "@/lib/storage-utils";
import type { Actor } from "@/lib/auth/server";

export class NoWritableStorageRootError extends Error {
  constructor() {
    super("No healthy writable storage root is available. Ask an administrator to configure storage.");
    this.name = "NoWritableStorageRootError";
  }
}

async function ensureLocalRoot() {
  if (!isLocalMode) return;
  const profile = await db.credentialProfile.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" }, update: {},
    create: { id: "00000000-0000-0000-0000-000000000001", name: "Local mock storage", type: "MOCK" },
  });
  await db.storageRoot.upsert({
    where: { googleFolderId: "mock-root-1" },
    update: { enabled: true, writable: true, lastHealthStatus: "HEALTHY" },
    create: { displayName: "Local demo root", googleFolderId: "mock-root-1", storageType: "MOCK", credentialProfileId: profile.id, enabled: true, writable: true, priority: 1, lastHealthStatus: "HEALTHY" },
  });
}

export async function ensureUser(actor: Actor) {
  await ensureLocalRoot();
  const user = await db.user.upsert({
    where: { clerkUserId: actor.clerkUserId },
    update: { email: actor.email, displayName: actor.displayName, avatarUrl: actor.avatarUrl },
    create: { clerkUserId: actor.clerkUserId, email: actor.email, displayName: actor.displayName, avatarUrl: actor.avatarUrl },
  });
  if (!user.active || user.deletedAt) throw new Response("Account inactive", { status: 403 });
  const migration = await db.rootMigration.findFirst({ where: { userId: user.id, state: { in: ["COPYING", "VERIFYING"] } }, select: { id: true } });
  if (migration) throw new Response("Storage migration is in progress. Please retry shortly.", { status: 423 });
  if (isLocalMode || !user.storageRootId) return user;

  const assignedRoot = await db.storageRoot.findUnique({
    where: { id: user.storageRootId },
    select: { id: true, storageType: true },
  });
  if (assignedRoot?.storageType !== "MOCK") return user;

  const storedFileCount = await db.mediaFile.count({ where: { userId: user.id } });
  if (storedFileCount > 0) {
    throw new Response("This account still has files in retired local demo storage. Migrate or remove that local data before using Google Drive.", { status: 409 });
  }

  const released = await db.$transaction(async (tx) => {
    await tx.uploadSession.updateMany({
      where: { userId: user.id, state: { notIn: ["COMPLETED", "CANCELLED"] } },
      data: { state: "CANCELLED", remoteSessionUrlEnc: null },
    });
    return tx.user.update({
      where: { id: user.id },
      data: {
        storageRootId: null,
        driveFolderId: null,
        provisioningState: "PENDING",
        provisioningStartedAt: null,
        provisioningError: null,
      },
    });
  });
  const assignedUserCount = await db.user.count({ where: { storageRootId: assignedRoot.id } });
  await db.storageRoot.update({ where: { id: assignedRoot.id }, data: { assignedUserCount } });
  return released;
}

async function ensureTripFolders(user: User, drive: Awaited<ReturnType<typeof driveFor>>) {
  if (!user.driveFolderId) throw new Error("User storage folder is missing");
  const trips = await db.trip.findMany({ where: { userId: user.id } });
  for (const trip of trips) {
    const properties = { tripnestTripId: trip.id, tripnestUserId: user.id };
    const tripFolder = await drive.findFolder(user.driveFolderId, properties)
      ?? await drive.createFolder(user.driveFolderId, tripFolderName(trip.name, trip.startDate), properties);
    const [photos, videos, documents, other] = await Promise.all([
      drive.createFolder(tripFolder.id, "Photos", { ...properties, tripnestCategory: "PHOTOS" }),
      drive.createFolder(tripFolder.id, "Videos", { ...properties, tripnestCategory: "VIDEOS" }),
      drive.createFolder(tripFolder.id, "Documents", { ...properties, tripnestCategory: "DOCUMENTS" }),
      drive.createFolder(tripFolder.id, "Other", { ...properties, tripnestCategory: "OTHER" }),
    ]);
    await db.trip.update({
      where: { id: trip.id },
      data: {
        driveFolderId: tripFolder.id,
        photosFolderId: photos.id,
        videosFolderId: videos.id,
        documentsFolderId: documents.id,
        otherFolderId: other.id,
      },
    });
  }
}

async function reserveRoot(user: User) {
  if (user.storageRootId) return user;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        if (fresh.storageRootId) return fresh;
        const root = await tx.storageRoot.findFirst({
          where: { enabled: true, writable: true, lastHealthStatus: "HEALTHY" },
          orderBy: [{ assignedUserCount: "asc" }, { priority: "asc" }, { id: "asc" }],
        });
        if (!root) throw new NoWritableStorageRootError();
        await tx.storageRoot.update({ where: { id: root.id }, data: { assignedUserCount: { increment: 1 } } });
        return tx.user.update({ where: { id: user.id }, data: { storageRootId: root.id, provisioningState: "PENDING", provisioningStartedAt: null, provisioningError: null } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 3) throw error;
    }
  }
  throw new Error("Could not reserve a storage root");
}

export async function ensureProvisioned(actor: Actor) {
  let user = await ensureUser(actor);
  if (user.provisioningState === "READY" && user.driveFolderId) return user;
  user = await reserveRoot(user);
  const claimed = await db.user.updateMany({
    where: { id: user.id, OR: [
      { provisioningState: "PENDING" },
      { provisioningState: "FAILED" },
      { provisioningState: "PROVISIONING", provisioningStartedAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    ] },
    data: { provisioningState: "PROVISIONING", provisioningStartedAt: new Date(), provisioningError: null },
  });
  if (claimed.count === 0) {
    for (let attempt = 0; attempt < 20; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const current = await db.user.findUniqueOrThrow({ where: { id: user.id } });
      if (current.provisioningState === "READY" && current.driveFolderId) return current;
      if (current.provisioningState === "FAILED") throw new Error(current.provisioningError ?? "Folder provisioning failed");
    }
    throw new Response("Folder provisioning is still running. Please retry.", { status: 409 });
  }
  try {
    const root = await db.storageRoot.findUniqueOrThrow({ where: { id: user.storageRootId! }, include: { credentialProfile: true } });
    const drive = await driveFor(root.credentialProfile);
    const properties = { tripnestUserId: user.id };
    const folder = await drive.findFolder(root.googleFolderId, properties)
      ?? await drive.createFolder(root.googleFolderId, `user_${user.id}`, properties);
    user = await db.user.update({ where: { id: user.id }, data: { driveFolderId: folder.id } });
    await ensureTripFolders(user, drive);
    return await db.user.update({ where: { id: user.id }, data: { provisioningState: "READY", provisioningError: null } });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Folder provisioning failed";
    await db.user.update({ where: { id: user.id }, data: { provisioningState: "FAILED", provisioningError: message } });
    throw error;
  }
}
