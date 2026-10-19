import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { tripFolderName } from "@/lib/storage-utils";
import { tripInput } from "@/lib/validation/schemas";
import type { Actor } from "@/lib/auth/server";
import { ensureProvisioned } from "@/lib/services/provisioning";

export async function listTrips(actor: Actor) {
  const user = await ensureProvisioned(actor);
  return db.trip.findMany({ where: { userId: user.id }, include: { _count: { select: { files: true } }, coverFile: true }, orderBy: [{ isFavorite: "desc" }, { startDate: "desc" }, { createdAt: "desc" }] });
}

export async function getTrip(actor: Actor, tripId: string) {
  const user = await ensureProvisioned(actor);
  return db.trip.findFirst({ where: { id: tripId, userId: user.id }, include: { files: { orderBy: { createdAt: "desc" } } } });
}

export async function createTrip(actor: Actor, input: z.infer<typeof tripInput>) {
  const user = await ensureProvisioned(actor);
  const root = await db.storageRoot.findUniqueOrThrow({ where: { id: user.storageRootId! }, include: { credentialProfile: true } });
  const drive = await driveFor(root.credentialProfile);
  const tripId = randomUUID();
  const properties = { tripnestTripId: tripId, tripnestUserId: user.id };
  const tripFolder = await drive.createFolder(user.driveFolderId!, tripFolderName(input.name, input.startDate), properties);
  const [photos, videos, documents, other] = await Promise.all([
    drive.createFolder(tripFolder.id, "Photos", { ...properties, tripnestCategory: "PHOTOS" }),
    drive.createFolder(tripFolder.id, "Videos", { ...properties, tripnestCategory: "VIDEOS" }),
    drive.createFolder(tripFolder.id, "Documents", { ...properties, tripnestCategory: "DOCUMENTS" }),
    drive.createFolder(tripFolder.id, "Other", { ...properties, tripnestCategory: "OTHER" }),
  ]);
  return db.trip.create({ data: {
    id: tripId, userId: user.id, name: input.name, slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "trip",
    startDate: input.startDate, endDate: input.endDate, description: input.description, location: input.location,
    driveFolderId: tripFolder.id, photosFolderId: photos.id, videosFolderId: videos.id, documentsFolderId: documents.id, otherFolderId: other.id,
  } });
}

export function categoryFolder(trip: { photosFolderId: string; videosFolderId: string; documentsFolderId: string; otherFolderId: string }, category: string) {
  return category === "PHOTOS" ? trip.photosFolderId : category === "VIDEOS" ? trip.videosFolderId : category === "DOCUMENTS" ? trip.documentsFolderId : trip.otherFolderId;
}
