import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { decryptSecret } from "@/lib/crypto";
import { apiError } from "@/lib/http";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ profileId: string }> }) {
  try {
    await requireAdmin();
    const profile = await db.credentialProfile.findUnique({ where: { id: (await params).profileId }, include: { roots: true } });
    if (!profile) return NextResponse.json({ error: "Credential profile not found" }, { status: 404 });
    if (profile.encryptedCredentials && profile.type === "OAUTH") {
      const tokens = JSON.parse(decryptSecret(profile.encryptedCredentials)) as { access_token?: string; refresh_token?: string };
      const token = tokens.refresh_token ?? tokens.access_token;
      if (token) await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) }).catch(() => undefined);
    }
    await db.$transaction([
      db.storageRoot.updateMany({ where: { credentialProfileId: profile.id }, data: { enabled: false, writable: false, lastHealthStatus: "UNAVAILABLE", lastHealthMessage: "Credential was revoked" } }),
      db.credentialProfile.update({ where: { id: profile.id }, data: { encryptedCredentials: null, revokedAt: new Date() } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
