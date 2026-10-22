import Link from "next/link";
import { format } from "date-fns";
import { CalendarDays, HardDrive, Images, MapPin, Sparkles } from "lucide-react";
import { isAdmin, requireActor } from "@/lib/auth/server";
import { listTrips } from "@/lib/services/trips";
import { NoWritableStorageRootError } from "@/lib/services/provisioning";
import { TripForm } from "@/components/trip-form";
import { FavoriteTripButton } from "@/components/favorite-trip-button";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const actor = await requireActor();
  let trips: Awaited<ReturnType<typeof listTrips>>;
  try {
    trips = await listTrips(actor);
  } catch (error) {
    if (!(error instanceof NoWritableStorageRootError)) throw error;
    const admin = isAdmin(actor.clerkUserId);
    return <section className="mx-auto max-w-2xl rounded-[2rem] border border-ink/10 bg-white px-7 py-12 text-center shadow-[0_16px_50px_rgba(29,39,36,.05)] sm:px-12">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-sand"><HardDrive className="size-6 text-coral" /></div>
      <h1 className="mt-6 font-display text-4xl">Storage setup needed</h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/55">{admin ? "Connect a Google Drive account and add a writable storage folder before creating trips." : "Your trips will be available after an administrator connects a writable storage folder."}</p>
      {admin && <Link href="/admin/storage" className="mt-7 inline-flex rounded-full bg-ink px-6 py-3 text-sm font-semibold text-white hover:bg-ink/90">Open storage settings</Link>}
    </section>;
  }
  return <>
    <section className="flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs text-ink/55"><Sparkles className="size-3.5 text-coral" /> Everything worth remembering, together</div><h1 className="font-display text-5xl sm:text-6xl">Your journeys</h1><p className="mt-3 text-sm text-ink/50">Welcome back{actor.displayName ? `, ${actor.displayName.split(" ")[0]}` : ""}. Where did life take you?</p></div><TripForm /></section>
    {trips.length === 0 ? <section className="mt-14 overflow-hidden rounded-[2.2rem] bg-ink px-7 py-16 text-center text-white sm:px-12"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10"><MapPin className="size-6 text-coral" /></div><h2 className="mt-6 font-display text-4xl">Every collection starts somewhere.</h2><p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/55">Create your first trip. We’ll prepare its private folders for photos, videos, documents, and everything in between.</p><div className="mt-7 flex justify-center"><TripForm /></div></section> : <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{trips.map((trip, index) => <article key={trip.id} className="group relative rounded-[1.8rem] border border-ink/8 bg-white p-5 shadow-[0_16px_50px_rgba(29,39,36,.05)] transition hover:-translate-y-1 hover:shadow-[0_22px_60px_rgba(29,39,36,.1)]"><FavoriteTripButton tripId={trip.id} initialFavorite={trip.isFavorite} /><Link href={`/trips/${trip.id}`} className="block"><div className={`relative h-44 overflow-hidden rounded-2xl ${["bg-[linear-gradient(145deg,#8ca695,#37564b)]", "bg-[linear-gradient(145deg,#dba470,#a75445)]", "bg-[linear-gradient(145deg,#8e9db5,#4a5468)]"][index % 3]} p-5 text-white`}>{trip.coverFileId && <><img src={`/api/files/${trip.coverFileId}/content`} alt="" className="absolute inset-0 size-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/70 to-black/10" /></>}<div className="relative"><span className="rounded-full bg-black/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest backdrop-blur">{format(trip.startDate, "MMM yyyy")}</span></div><div className="relative mt-16"><p className="font-display text-3xl">{trip.name}</p>{trip.location && <p className="mt-1 flex items-center gap-1 text-xs text-white/70"><MapPin className="size-3" /> {trip.location}</p>}</div></div><div className="mt-4 flex items-center justify-between"><div className="flex items-center gap-2 text-xs text-ink/45"><CalendarDays className="size-3.5" /> {format(trip.startDate, "dd MMM yyyy")}</div><div className="flex items-center gap-2 text-xs font-semibold"><Images className="size-3.5 text-coral" /> {trip._count.files} files</div></div></Link></article>)}</section>}
  </>;
}
