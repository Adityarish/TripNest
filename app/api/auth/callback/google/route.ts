import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { requireAdmin } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { decryptSecret, encryptSecret, verifyState } from "@/lib/crypto";
import { db } from "@/lib/db";
import { apiError } from "@/lib/http";

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdmin();
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const decoded = state && verifyState(state);
    if (!code || !decoded) return NextResponse.json({ error: "Invalid OAuth callback" }, { status: 400 });
    const payload = JSON.parse(Buffer.from(decoded, "base64url").toString("utf8")) as { sub: string; iat: number };
    if (payload.sub !== actor.clerkUserId || Date.now() - payload.iat > 10 * 60 * 1000) return NextResponse.json({ error: "OAuth state expired or did not match" }, { status: 400 });
    const oauth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`);
    const { tokens } = await oauth.getToken(code);
    oauth.setCredentials(tokens);
    const drive = google.drive({ version: "v3", auth: oauth });
    const about = await drive.about.get({ fields: "user(emailAddress,displayName)" });
    const email = about.data.user?.emailAddress;
    const existing = email ? await db.credentialProfile.findFirst({ where: { googleAccountEmail: email, type: "OAUTH" } }) : null;
    const previous = existing?.encryptedCredentials ? JSON.parse(decryptSecret(existing.encryptedCredentials)) as { refresh_token?: string } : null;
    const merged = { ...tokens, refresh_token: tokens.refresh_token ?? previous?.refresh_token };
    if (!merged.refresh_token) return NextResponse.json({ error: "Google did not issue offline access. Revoke the app in your Google account and reconnect." }, { status: 409 });
    const data = { name: about.data.user?.displayName ? `${about.data.user.displayName} Drive` : "Google Drive", type: "OAUTH" as const, encryptedCredentials: encryptSecret(JSON.stringify(merged)), googleAccountEmail: email, revokedAt: null };
    if (existing) await db.credentialProfile.update({ where: { id: existing.id }, data });
    else await db.credentialProfile.create({ data });
    return NextResponse.redirect(new URL("/admin/storage?connected=1", env.NEXT_PUBLIC_APP_URL));
  } catch (error) { return apiError(error); }
}
