"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DriveAccessRequestForm({ initialEmail, submitLabel = "Request Google Drive access" }: { initialEmail: string; submitLabel?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    try {
      const data = new FormData(event.currentTarget);
      const response = await fetch("/api/drive-access-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ googleEmail: data.get("googleEmail") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send request");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not send request");
    } finally { setPending(false); }
  }

  return <form onSubmit={submit} className="mt-5 space-y-3">
    <label className="field"><span>Google account email to approve</span><Input name="googleEmail" type="email" defaultValue={initialEmail} placeholder="you@gmail.com" required /></label>
    <p className="text-xs leading-5 text-ink/50">Use the exact Google account you will connect to Drive. An administrator must add it to Google&apos;s test-user list before approval.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <Button variant="coral" disabled={pending}>{pending ? "Sending request…" : submitLabel}</Button>
  </form>;
}
