import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { assertAuthConfiguration, assertProductionConfiguration, env, isLocalMode } from "@/lib/env";

export type Actor = { clerkUserId: string; email?: string; displayName?: string; avatarUrl?: string };

export async function getActor(): Promise<Actor | null> {
  if (env.NODE_ENV === "production") assertProductionConfiguration();
  else assertAuthConfiguration();
  if (isLocalMode) {
    return { clerkUserId: "local_demo_user", email: env.MOCK_USER_EMAIL, displayName: env.MOCK_USER_NAME };
  }
  const session = await auth();
  if (!session.userId) return null;
  const user = await (await clerkClient()).users.getUser(session.userId);
  return {
    clerkUserId: session.userId,
    email: user.primaryEmailAddress?.emailAddress,
    displayName: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
    avatarUrl: user.imageUrl,
  };
}

export async function requireActor() {
  const actor = await getActor();
  if (!actor) throw new Response("Unauthorized", { status: 401 });
  return actor;
}

export function isAdmin(clerkUserId: string) {
  if (isLocalMode) return true;
  return new Set(env.ADMIN_CLERK_USER_IDS.split(",").map((id) => id.trim()).filter(Boolean)).has(clerkUserId);
}

export async function requireAdmin() {
  const actor = await requireActor();
  if (!isAdmin(actor.clerkUserId)) throw new Response("Forbidden", { status: 403 });
  return actor;
}
