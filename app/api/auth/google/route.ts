import { NextResponse } from "next/server";
import { google } from "googleapis";
import { randomUUID } from "node:crypto";
import { isAdmin, requireActor } from "@/lib/auth/server";
import { env, googleOAuthRedirectUri } from "@/lib/env";
import { signState } from "@/lib/crypto";
import { apiError } from "@/lib/http";
import { db } from "@/lib/db";
import { personalDriveUser } from "@/lib/services/personal-storage";

export async function GET(request: Request) {
  try {
    const actor = await requireActor();
    const personal = new URL(request.url).searchParams.get("storage") === "personal";
    if (personal) {
      if (isAdmin(actor.clerkUserId)) throw new Response("Use the admin storage console to connect a Drive account.", { status: 403 });
      const { user, root, profile } = await personalDriveUser(actor);
      if (!root || !profile?.googleAccountEmail) {
        const access = await db.driveAccessRequest.findUnique({ where: { userId: user.id } });
        if (access?.status !== "APPROVED") throw new Response("Request Google Drive access and wait for approval before connecting", { status: 403 });
      }
    } else if (!isAdmin(actor.clerkUserId)) {
      throw new Response("Forbidden", { status: 403 });
    }
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: "Google OAuth is not configured" }, { status: 503 });
    const oauth = new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, googleOAuthRedirectUri);
    const statePayload = Buffer.from(JSON.stringify({ sub: actor.clerkUserId, purpose: personal ? "personal" : "admin", nonce: randomUUID(), iat: Date.now() })).toString("base64url");
    const url = oauth.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["https://www.googleapis.com/auth/drive"], state: signState(statePayload), include_granted_scopes: true });
    return NextResponse.redirect(url);
  } catch (error) { return apiError(error); }
}
