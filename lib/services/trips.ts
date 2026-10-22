import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { tripFolderName } from "@/lib/storage-utils";
import { tripInput } from "@/lib/validation/schemas";
import type { Actor } from "@/lib/auth/server";
import { ensureProvisioned, ensureUser } from "@/lib/services/provisioning";
import { isAdmin } from "@/lib/auth/server";

export async function listTrips(actor: Actor) {
  const user = await ensureUser(actor);
  return db.trip.findMany({ where: { userId: user.id }, include: { _count: { select: { files: true } }, coverFile: true }, orderBy: [{ isFavorite: "desc" }, { startDate: "desc" }, { createdAt: "desc" }] });
}

export async function getTrip(actor: Actor, tripId: string) {
  const user = await ensureUser(actor);
  return db.trip.findFirst({ where: { id: tripId, userId: user.id }, include: { files: { orderBy: { createdAt: "desc" } } } });
}

export async function createTrip(actor: Actor, input: z.infer<typeof tripInput>) {
  const user = input.storage === "personal" ? await ensureUser(actor) : await ensureProvisioned(actor);
  if (input.storage === "personal" && isAdmin(actor.clerkUserId)) throw new Response("Personal Drive storage is available to non-admin users", { status: 403 });
  const root = input.storage === "personal"
    ? await db.storageRoot.findUnique({ where: { ownerUserId: user.id }, include: { credentialProfile: true } })
    : await db.storageRoot.findUnique({ where: { id: user.storageRootId! }, include: { credentialProfile: true } });
  if (input.storage === "universal" && root?.ownerUserId) throw new Response("Shared storage is unavailable. Ask an administrator to check the shared Drive.", { status: 409 });
  if (!root || !root.enabled || !root.writable || root.lastHealthStatus !== "HEALTHY" || root.credentialProfile.revokedAt || !root.credentialProfile.encryptedCredentials && root.credentialProfile.type !== "MOCK") {
    throw new Response(input.storage === "personal" ? "Connect your Google Drive before choosing personal storage." : "Shared storage is unavailable. Ask an administrator to check the shared Drive.", { status: 409 });
  }
  const drive = await driveFor(root.credentialProfile);
  const parentFolderId = input.storage === "personal"
    ? (await drive.findFolder(root.googleFolderId, { tripnestUserId: user.id })
      ?? await drive.createFolder(root.googleFolderId, `user_${user.id}`, { tripnestUserId: user.id })).id
    : user.driveFolderId!;
  const tripId = randomUUID();
  const properties = { tripnestTripId: tripId, tripnestUserId: user.id };
  const tripFolder = await drive.createFolder(parentFolderId, tripFolderName(input.name, input.startDate), properties);
  const [photos, videos, documents, other] = await Promise.all([
    drive.createFolder(tripFolder.id, "Photos", { ...properties, tripnestCategory: "PHOTOS" }),
    drive.createFolder(tripFolder.id, "Videos", { ...properties, tripnestCategory: "VIDEOS" }),
    drive.createFolder(tripFolder.id, "Documents", { ...properties, tripnestCategory: "DOCUMENTS" }),
    drive.createFolder(tripFolder.id, "Other", { ...properties, tripnestCategory: "OTHER" }),
  ]);
  return db.trip.create({ data: {
    id: tripId, userId: user.id, storageRootId: root.id, name: input.name, slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip",
    startDate: input.startDate, endDate: input.endDate, description: input.description, location: input.location,
    driveFolderId: tripFolder.id, photosFolderId: photos.id, videosFolderId: videos.id, documentsFolderId: documents.id, otherFolderId: other.id,
  } });
}

export function categoryFolder(trip: { photosFolderId: string; videosFolderId: string; documentsFolderId: string; otherFolderId: string }, category: string) {
  return category === "PHOTOS" ? trip.photosFolderId : category === "VIDEOS" ? trip.videosFolderId : category === "DOCUMENTS" ? trip.documentsFolderId : trip.otherFolderId;
}
