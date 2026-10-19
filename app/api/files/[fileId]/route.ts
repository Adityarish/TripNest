import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { ensureUser } from "@/lib/services/provisioning";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { apiError } from "@/lib/http";
import { filePatchInput } from "@/lib/validation/schemas";
import { categoryFolder } from "@/lib/services/trips";
import { safeFilename } from "@/lib/storage-utils";

export const runtime = "nodejs";

async function context(fileId: string) {
  const user = await ensureUser(await requireActor());
  const file = await db.mediaFile.findFirst({ where: { id: fileId, userId: user.id }, include: { trip: true } });
  if (!file) throw new Response("File not found", { status: 404 });
  const root = await db.storageRoot.findUniqueOrThrow({ where: { id: user.storageRootId! }, include: { credentialProfile: true } });
  return { user, file, drive: await driveFor(root.credentialProfile) };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { user, file, drive } = await context((await params).fileId);
    const input = filePatchInput.parse(await request.json());
    const destination = input.tripId ? await db.trip.findFirst({ where: { id: input.tripId, userId: user.id } }) : file.trip;
    if (!destination) return NextResponse.json({ error: "Destination trip not found" }, { status: 404 });
    const targetCategory = input.category ?? file.category;
    const oldParent = categoryFolder(file.trip, file.category);
    const newParent = categoryFolder(destination, targetCategory);
    if (oldParent !== newParent) await drive.moveFile(file.driveFileId, oldParent, newParent);
    if (input.name && input.name !== file.name) await drive.renameFile(file.driveFileId, safeFilename(input.name));
    const updated = await db.mediaFile.update({
      where: { id: file.id },
      data: {
        tripId: destination.id,
        category: targetCategory,
        name: input.name ? safeFilename(input.name) : undefined,
        isFavorite: input.isFavorite,
      },
    });
    return NextResponse.json({ ...updated, sizeBytes: updated.sizeBytes.toString() });
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const { file, drive } = await context((await params).fileId);
    await drive.deleteFile(file.driveFileId);
    await db.mediaFile.delete({ where: { id: file.id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
