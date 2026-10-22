import { notFound } from "next/navigation";
import { requireActor, isAdmin } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { AdminConsole } from "@/components/admin-console";
import { jsonSafe } from "@/lib/utils";
import { syncEnvironmentStorageRoots } from "@/lib/services/storage-config";
import { googleOAuthRedirectUri } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function StorageAdminPage() {
  const actor = await requireActor();
  if (!isAdmin(actor.clerkUserId)) notFound();
  await syncEnvironmentStorageRoots();
  const [roots, profiles, users, migrations] = await Promise.all([
    db.storageRoot.findMany({ where: { ownerUserId: null }, include: { credentialProfile: { select: { id: true, name: true, type: true, googleAccountEmail: true, revokedAt: true } } }, orderBy: [{ priority: "asc" }, { id: "asc" }] }),
    db.credentialProfile.findMany({ where: { ownerUserId: null }, select: { id: true, name: true, type: true, googleAccountEmail: true, revokedAt: true }, orderBy: { createdAt: "desc" } }),
    db.user.findMany({ select: { id: true, displayName: true, email: true, storageRootId: true, active: true, deletedAt: true, driveFolderId: true }, orderBy: { createdAt: "desc" } }),
    db.rootMigration.findMany({ select: { id: true, userId: true, state: true, errorMessage: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  return <AdminConsole roots={jsonSafe(roots)} profiles={jsonSafe(profiles)} users={jsonSafe(users)} migrations={jsonSafe(migrations)} googleRedirectUri={googleOAuthRedirectUri} />;
}
