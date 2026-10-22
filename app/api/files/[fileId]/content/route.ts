import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import { requireActor } from "@/lib/auth/server";
import { ensureUser } from "@/lib/services/provisioning";
import { db } from "@/lib/db";
import { driveFor } from "@/lib/drive";
import { apiError } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ fileId: string }> }) {
  try {
    const user = await ensureUser(await requireActor());
    const file = await db.mediaFile.findFirst({ where: { id: (await params).fileId, userId: user.id }, include: { trip: true } });
    if (!file) return NextResponse.json({ error: "File not found" }, { status: 404 });
    if (!file.trip.storageRootId) throw new Response("Trip storage is unavailable", { status: 409 });
    const root = await db.storageRoot.findUniqueOrThrow({ where: { id: file.trip.storageRootId }, include: { credentialProfile: true } });
    const content = await driveFor(root.credentialProfile).then((drive) => drive.downloadFile(file.driveFileId));
    const safePreview = /^(image\/(?:jpeg|png|gif|webp|avif)|video\/(?:mp4|webm|quicktime)|audio\/(?:mpeg|mp4|ogg|wav)|application\/pdf)$/.test(content.mimeType);
    const disposition = request.nextUrl.searchParams.get("download") === "1" || !safePreview ? "attachment" : "inline";
    return new Response(Readable.toWeb(content.stream) as ReadableStream, { headers: {
      "Content-Type": content.mimeType, "Content-Length": String(content.size ?? file.sizeBytes),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(content.name)}`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox",
    } });
  } catch (error) { return apiError(error); }
}
