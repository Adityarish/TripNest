"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, MapPin, Plus, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function TripForm() {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    let response: Response;
    let result: { id?: string; error?: string };
    try {
      response = await fetch("/api/trips", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), startDate: data.get("startDate"), endDate: data.get("endDate"), location: data.get("location"), description: data.get("description") }) });
      result = await response.json();
    } catch {
      setPending(false); setError("Could not reach TripNest. Check your connection and try again."); return;
    }
    if (!response.ok) { setPending(false); return setError(result.error ?? "Could not create the trip"); }
    if (!result.id) { setPending(false); return setError("Trip was not created. Please try again."); }
    const cover = data.get("cover") as File;
    let coverError = "";
    if (cover?.size) {
      try {
        const started = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tripId: result.id, name: cover.name, mimeType: cover.type || "image/jpeg", sizeBytes: cover.size }) });
        const session = await started.json();
        if (!started.ok) throw new Error(session.error);
        let offset = 0; let finalFileId = ""; const chunkSize = 5 * 1024 * 1024;
        while (offset < cover.size) {
          const end = Math.min(offset + chunkSize, cover.size);
          const uploaded = await fetch(`/api/uploads/${session.id}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "Content-Range": `bytes ${offset}-${end - 1}/${cover.size}` }, body: cover.slice(offset, end) });
          const state = await uploaded.json();
          if (!uploaded.ok) throw new Error(state.error);
          offset = Number(state.uploadedBytes); finalFileId = state.file?.id ?? finalFileId;
        }
        if (finalFileId) await fetch(`/api/trips/${result.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coverFileId: finalFileId }) });
      } catch (error) { coverError = error instanceof Error ? error.message : "Cover upload failed"; }
    }
    setPending(false);
    setOpen(false); router.push(`/trips/${result.id}${coverError ? `?coverError=${encodeURIComponent(coverError)}` : ""}`); router.refresh();
  }

  return <>
    <Button variant="coral" onClick={() => setOpen(true)}><Plus className="size-4" /> New trip</Button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-[2rem] bg-cream p-6 shadow-2xl sm:p-8">
        <div className="mb-6 flex items-start justify-between"><div><p className="eyebrow">A new chapter</p><h2 className="mt-2 font-display text-3xl">Create a trip</h2></div><Button type="button" variant="ghost" size="icon" aria-label="Close" onClick={() => setOpen(false)}><X /></Button></div>
        <div className="space-y-4">
          <label className="field"><span>Trip name</span><Input name="name" placeholder="Monsoon in Munnar" required autoFocus /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field"><span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Start date</span><Input name="startDate" type="date" defaultValue={format(new Date(), "yyyy-MM-dd")} required /></label>
            <label className="field"><span>End date <i>optional</i></span><Input name="endDate" type="date" /></label>
          </div>
          <label className="field"><span className="flex items-center gap-1.5"><MapPin className="size-3.5" /> Location <i>optional</i></span><Input name="location" placeholder="Kerala, India" /></label>
          <label className="field"><span>Story <i>optional</i></span><Textarea name="description" placeholder="What makes this trip one to remember?" /></label>
          <label className="field"><span>Cover photo <i>optional</i></span><Input name="cover" type="file" accept="image/*" /></label>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button variant="coral" disabled={pending}>{pending ? "Building your nest…" : "Create trip"}</Button></div>
      </form>
    </div>}
  </>;
}
