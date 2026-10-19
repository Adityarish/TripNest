import { NextResponse } from "next/server";
import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { signState } from "@/lib/crypto";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const actor = await requireAdmin();
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
    const oauth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`);
    const statePayload = Buffer.from(JSON.stringify({ sub: actor.clerkUserId, nonce: randomUUID(), iat: Date.now() })).toString("base64url");
    const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive"], state: signState(statePayload), include_granted_scopes: true });
    return NextResponse.redirect(url);
  } catch (error) { return apiError(error); }
}
