import Link from "next/link";
import { Bell } from "lucide-react";
import { requireActor } from "@/lib/auth/server";
import { db } from "@/lib/db";
import { ensureUser } from "@/lib/services/provisioning";
import { NotificationReadButton } from "@/components/notification-read-button";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await ensureUser(await requireActor());
  const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 });

  return <div className="mx-auto max-w-3xl space-y-6">
    <header><div className="grid size-12 place-items-center rounded-2xl bg-sand"><Bell className="size-5 text-coral" /></div><h1 className="mt-5 font-display text-4xl">Notifications</h1><p className="mt-2 text-sm text-ink/50">Updates about your TripNest account and Drive access.</p></header>
    <div className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white">
      {notifications.map((notification) => <article key={notification.id} className={`p-5 ${notification.readAt ? "" : "bg-sand/30"}`}>
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{notification.title}</h2><p className="mt-2 text-sm leading-6 text-ink/60">{notification.body}</p><p className="mt-2 text-xs text-ink/40">{notification.createdAt.toLocaleString()}</p></div>{!notification.readAt && <span className="mt-1 size-2 shrink-0 rounded-full bg-coral" aria-label="Unread" />}</div>
        <div className="mt-3 flex items-center gap-2">{notification.href && <Link href={notification.href} className="text-sm font-semibold text-coral hover:underline">Open My Drive</Link>}{!notification.readAt && <NotificationReadButton id={notification.id} />}</div>
      </article>)}
      {!notifications.length && <p className="p-8 text-center text-sm text-ink/50">No notifications yet.</p>}
    </div>
  </div>;
}
