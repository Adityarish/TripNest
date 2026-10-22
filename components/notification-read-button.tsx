"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function NotificationReadButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const router = useRouter();

  async function markRead() {
    setPending(true); setError(false);
    try {
      const response = await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      if (response.ok) router.refresh();
      else setError(true);
    } catch {
      setError(true);
    } finally { setPending(false); }
  }

  return <span className="inline-flex items-center gap-2"><Button type="button" size="sm" variant="ghost" disabled={pending} onClick={markRead}>Mark read</Button>{error && <span role="alert" className="text-xs text-red-700">Try again</span>}</span>;
}
