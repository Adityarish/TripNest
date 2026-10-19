import { NextRequest, NextResponse } from "next/server";
import { requireActor } from "@/lib/auth/server";
import { apiError } from "@/lib/http";
import { ensureUser } from "@/lib/services/provisioning";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { decryptSecret } from "@/lib/crypto";
import { jsonSafe } from "@/lib/utils";
import { categoryFolder } from "@/lib/services/trips";
import type { UploadedFileInfo } from "@/lib/drive/types";

export const runtime = "nodejs";

async function ownedUpload(uploadId: string) {
  const user = await ensureUser(await requireActor());
  const upload = await db.uploadSession.findFirst({ where: { id: uploadId, userId: user.id }, include: { trip: true } });
  if (!upload) throw new Response("Upload not found", { status: 404 });
  return { upload, user };
}

async function finalizeUpload(
  upload: Awaited<ReturnType<typeof ownedUpload>>["upload"],
  user: Awaited<ReturnType<typeof ownedUpload>>["user"],
  file: UploadedFileInfo,
) {
  if (file.size !== undefined && BigInt(file.size) !== upload.sizeBytes) {
    throw new Response("Uploaded file size does not match the expected size", { status: 409 });
  }
  const media = await db.$transaction(async (tx) => {
    const saved = await tx.mediaFile.upsert({
      where: { driveFileId: file.id }, update: {},
      create: { userId: user.id, tripId: upload.tripId, driveFileId: file.id, name: upload.originalName, mimeType: upload.mimeType, sizeBytes: upload.sizeBytes, category: upload.category, checksumMd5: file.md5Checksum },
    });
    await tx.uploadSession.update({ where: { id: upload.id }, data: { state: "COMPLETED", uploadedBytes: upload.sizeBytes, driveFileId: file.id, remoteSessionUrlEnc: null } });
    return saved;
  });
  return NextResponse.json(jsonSafe({ complete: true, uploadedBytes: upload.sizeBytes, file: media }));
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const { upload } = await ownedUpload((await params).uploadId);
    return NextResponse.json(jsonSafe({ id: upload.id, state: upload.state, uploadedBytes: upload.uploadedBytes, sizeBytes: upload.sizeBytes, errorMessage: upload.errorMessage }));
  } catch (error) { return apiError(error); }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const { upload, user } = await ownedUpload((await params).uploadId);
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(upload.state)) return NextResponse.json({ error: `Upload is ${upload.state.toLowerCase()}` }, { status: 409 });
    if (upload.expiresAt < new Date()) {
      await db.uploadSession.update({ where: { id: upload.id }, data: { state: "EXPIRED" } });
      return NextResponse.json({ error: "Upload session expired; start it again" }, { status: 410 });
    }
    const range = request.headers.get("content-range")?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    if (!range) return NextResponse.json({ error: "A valid Content-Range header is required" }, { status: 400 });
    const [, startRaw, endRaw, totalRaw] = range;
    const [start, end, total] = [Number(startRaw), Number(endRaw), Number(totalRaw)];
    if (start !== Number(upload.uploadedBytes) || total !== Number(upload.sizeBytes) || end < start) {
      return NextResponse.json({ error: "Chunk range does not match server progress", uploadedBytes: upload.uploadedBytes.toString() }, { status: 409 });
    }
    const chunk = new Uint8Array(await request.arrayBuffer());
    if (chunk.byteLength !== end - start + 1) return NextResponse.json({ error: "Chunk length does not match Content-Range" }, { status: 400 });
    const root = await db.storageRoot.findUniqueOrThrow({ where: { id: user.storageRootId! }, include: { credentialProfile: true } });
    const drive = await driveFor(root.credentialProfile);
    // The remote final chunk can succeed even if the database commit or response fails.
    // Recover by the stable upload ID before attempting to reuse an expired Drive session.
    const existing = await drive.findFile(categoryFolder(upload.trip, upload.category), { tripnestUploadId: upload.id });
    if (existing) return finalizeUpload(upload, user, existing);
    const result = await drive.uploadChunk(decryptSecret(upload.remoteSessionUrlEnc!), chunk, start, end, total);
    if (!result.complete || !result.file) {
      await db.uploadSession.update({ where: { id: upload.id }, data: { state: "UPLOADING", uploadedBytes: BigInt(result.uploadedBytes) } });
      return NextResponse.json({ complete: false, uploadedBytes: String(result.uploadedBytes) });
    }
    return finalizeUpload(upload, user, result.file);
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ uploadId: string }> }) {
  try {
    const { upload } = await ownedUpload((await params).uploadId);
    if (upload.state === "COMPLETED") return NextResponse.json({ error: "Completed uploads cannot be cancelled" }, { status: 409 });
    await db.uploadSession.update({ where: { id: upload.id }, data: { state: "CANCELLED", remoteSessionUrlEnc: null } });
    return new NextResponse(null, { status: 204 });
  } catch (error) { return apiError(error); }
}
