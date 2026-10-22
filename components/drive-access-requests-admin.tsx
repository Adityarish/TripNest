"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type AccessRequest = {
  id: string;
  googleEmail: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  createdAt: string | Date;
  user: { displayName: string | null; email: string | null };
};

export function DriveAccessRequestsAdmin({ requests }: { requests: AccessRequest[] }) {
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const pendingRequests = requests.filter((request) => request.status === "PENDING");

  async function decide(id: string, decision: "APPROVED" | "DECLINED") {
    setPending(id); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/admin/drive-access-requests/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, googleTestUserAdded: Boolean(confirmed[id]) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not review request");
      setMessage(decision === "APPROVED" ? "Approved and notified the user." : "Declined and notified the user.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not review request");
    } finally { setPending(""); }
  }

  return <section id="drive-access-requests" className="rounded-2xl border border-ink/9 bg-white p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Google OAuth testing</p><h2 className="mt-2 font-display text-3xl">Drive access requests</h2></div><span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold">{pendingRequests.length} pending</span></div>
    <p className="mt-3 text-sm leading-6 text-ink/55">Before approving, open the Google Cloud project used by this app&apos;s <code>GOOGLE_CLIENT_ID</code>, go to <a className="font-semibold underline" href="https://console.cloud.google.com/auth/audience" target="_blank" rel="noreferrer">Google Auth Platform → Audience → Test users</a>, and add the exact email below. TripNest cannot add Google test users automatically.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="mt-4 rounded-xl bg-sage/10 p-3 text-sm text-ink/70">{message}</p>}
    <div className="mt-5 divide-y divide-ink/10">
      {pendingRequests.map((request) => <article key={request.id} className="py-5 first:pt-0 last:pb-0">
        <p className="font-semibold">{request.user.displayName ?? request.user.email ?? "TripNest user"}</p>
        <p className="mt-1 select-all break-all text-sm text-ink/70">{request.googleEmail}</p>
        <p className="mt-1 text-xs text-ink/40">Requested {new Date(request.createdAt).toLocaleString()}</p>
        <label className="mt-4 flex items-start gap-2 text-sm text-ink/65"><input type="checkbox" checked={Boolean(confirmed[request.id])} onChange={(event) => setConfirmed((previous) => ({ ...previous, [request.id]: event.target.checked }))} className="mt-1" /><span>I added this exact email to the Google OAuth app&apos;s Test users list.</span></label>
        <div className="mt-4 flex gap-2"><Button size="sm" disabled={!confirmed[request.id] || pending === request.id} onClick={() => decide(request.id, "APPROVED")}>Approve and notify</Button><Button size="sm" variant="outline" disabled={pending === request.id} onClick={() => decide(request.id, "DECLINED")}>Decline</Button></div>
      </article>)}
      {!pendingRequests.length && <p className="py-4 text-sm text-ink/50">No requests are waiting for review.</p>}
    </div>
  </section>;
}
