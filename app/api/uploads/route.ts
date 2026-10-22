import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { apiError } from "@/lib/http";
import { uploadInput, categoryForMime } from "@/lib/validation/schemas";
import { ensureUser } from "@/lib/services/provisioning";
import { categoryFolder } from "@/lib/services/trips";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { encryptSecret } from "@/lib/crypto";
import { safeFilename } from "@/lib/storage-utils";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const actor = await requireActor();
    const input = uploadInput.parse(await request.json());
    const user = await ensureUser(actor);
    const trip = await db.trip.findFirst({ where: { id: input.tripId, userId: user.id } });
    if (!trip) return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    if (!trip.storageRootId) throw new Response("Trip storage is unavailable", { status: 409 });
    const category = categoryForMime(input.mimeType);
    const uploadId = randomUUID();
    const root = await db.storageRoot.findUniqueOrThrow({ where: { id: trip.storageRootId }, include: { credentialProfile: true } });
    const session = await driveFor(root.credentialProfile).then((drive) => drive.createResumableUpload({
      parentId: categoryFolder(trip, category), name: safeFilename(input.name), mimeType: input.mimeType, size: Number(input.sizeBytes),
      appProperties: { tripnestUserId: user.id, tripnestTripId: trip.id, tripnestUploadId: uploadId },
    }));
    const upload = await db.uploadSession.create({ data: {
      id: uploadId,
      userId: user.id, tripId: trip.id, originalName: safeFilename(input.name), mimeType: input.mimeType,
      sizeBytes: input.sizeBytes, category, remoteSessionUrlEnc: encryptSecret(session), expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
    } });
    return NextResponse.json({ id: upload.id, uploadedBytes: "0", expiresAt: upload.expiresAt }, { status: 201 });
  } catch (error) { return apiError(error); }
}
