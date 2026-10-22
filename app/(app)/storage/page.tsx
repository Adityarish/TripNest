import Link from "next/link";
import { redirect } from "next/navigation";
import { HardDrive, ShieldCheck } from "lucide-react";
import { isAdmin, requireActor } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { personalDriveUser } from "@/lib/services/personal-storage";

export const dynamic = "force-dynamic";

export default async function PersonalStoragePage() {
  const actor = await requireActor();
  if (isAdmin(actor.clerkUserId)) redirect("/admin/storage");
  const { user, root, profile } = await personalDriveUser(actor);
  const alreadyAssigned = Boolean(root && user.storageRootId === root.id);
  const hasExistingData = !alreadyAssigned && Boolean(
    (await db.trip.count({ where: { userId: user.id } }))
    || (await db.mediaFile.count({ where: { userId: user.id } }))
    || (await db.uploadSession.count({ where: { userId: user.id } })),
  );
  const connected = alreadyAssigned && root?.enabled && root.writable && root.lastHealthStatus === "HEALTHY";

  return <div className="mx-auto max-w-3xl space-y-6">
    <section className="rounded-[2rem] bg-ink px-7 py-10 text-white sm:px-10">
      <div className="grid size-14 place-items-center rounded-2xl bg-white/10"><HardDrive className="size-6 text-coral" /></div>
      <h1 className="mt-6 font-display text-4xl">Your Google Drive</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">Connect your own Google Drive to keep TripNest originals in a private TripNest folder in your My Drive. Your files use your Google storage space.</p>
    </section>
    <section className="rounded-2xl border border-ink/10 bg-white p-7">
      <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-sage" /><h2 className="font-semibold">{connected ? "Drive connected" : "Connect personal storage"}</h2></div>
      {connected && <p className="mt-3 text-sm text-ink/60">{profile?.googleAccountEmail ?? "Your Google account"} is connected and its TripNest folder is ready.</p>}
      {!connected && <p className="mt-3 text-sm text-ink/60">{hasExistingData ? "Your current trips already use another storage root. Contact an administrator before switching to your own Drive." : "Connect a Google account to create and verify your personal TripNest storage folder."}</p>}
      {!hasExistingData && <Link href="/api/auth/google?storage=personal" className="mt-6 inline-flex rounded-full bg-coral px-6 py-3 text-sm font-semibold text-white hover:bg-coral/90">{connected ? "Reconnect Google Drive" : "Connect Google Drive"}</Link>}
      {root?.folderUrl && <p className="mt-5 text-xs text-ink/45"><a href={root.folderUrl} target="_blank" rel="noreferrer" className="underline">Open your TripNest folder in Drive</a></p>}
    </section>
    <Link href="/dashboard" className="inline-block text-sm font-semibold text-ink/60 hover:text-ink">Back to your trips</Link>
  </div>;
}
