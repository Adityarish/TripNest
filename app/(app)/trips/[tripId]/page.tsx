import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { requireActor } from "@/lib/auth/server";
import { getTrip, listTrips } from "@/lib/services/trips";
import { FileManager } from "@/components/file-manager";
import { jsonSafe } from "@/lib/utils";
import { FavoriteTripButton } from "@/components/favorite-trip-button";

export const dynamic = "force-dynamic";

export default async function TripPage({ params, searchParams }: { params: Promise<{ tripId: string }>; searchParams: Promise<{ coverError?: string }> }) {
  const actor = await requireActor();
  const [trip, trips] = await Promise.all([getTrip(actor, (await params).tripId), listTrips(actor)]);
  if (!trip) notFound();
  const coverError = (await searchParams).coverError?.slice(0, 250);
  return <>
    <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-ink/50 hover:text-ink"><ArrowLeft className="size-4" /> All journeys</Link>
    {coverError && <p role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">Trip created, but the optional cover could not upload: {coverError}. You can add the photo below.</p>}
    <section className="relative mt-7 overflow-hidden rounded-[2rem] bg-ink px-7 py-10 text-white sm:px-10 sm:py-14"><div className="absolute -right-20 -top-28 size-80 rounded-full bg-coral/25 blur-3xl" /><div className="relative"><div className="flex items-start justify-between gap-5"><div><p className="eyebrow">Your private collection</p><h1 className="mt-3 font-display text-5xl sm:text-6xl">{trip.name}</h1></div><FavoriteTripButton tripId={trip.id} initialFavorite={trip.isFavorite} placement="trip" /></div><div className="mt-5 flex flex-wrap gap-4 text-sm text-white/60"><span className="flex items-center gap-2"><CalendarDays className="size-4 text-coral" /> {format(trip.startDate, "dd MMM yyyy")}{trip.endDate ? ` — ${format(trip.endDate, "dd MMM yyyy")}` : ""}</span>{trip.location && <span className="flex items-center gap-2"><MapPin className="size-4 text-coral" /> {trip.location}</span>}</div>{trip.description && <p className="mt-6 max-w-2xl text-sm leading-6 text-white/55">{trip.description}</p>}</div></section>
    <FileManager tripId={trip.id} tripName={trip.name} trips={trips.map(({ id, name }) => ({ id, name }))} initialFiles={jsonSafe(trip.files)} />
  </>;
}
