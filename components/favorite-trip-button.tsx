"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FavoriteTripButtonProps = {
  tripId: string;
  initialFavorite: boolean;
  placement?: "card" | "trip";
};

export function FavoriteTripButton({ tripId, initialFavorite, placement = "card" }: FavoriteTripButtonProps) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function toggleFavorite() {
    const nextFavorite = !favorite;
    setFavorite(nextFavorite);
    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: nextFavorite }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error ?? "Could not update favorite");
      }
      router.refresh();
    } catch (caught) {
      setFavorite(!nextFavorite);
      setError(caught instanceof Error ? caught.message : "Could not update favorite");
    } finally {
      setPending(false);
    }
  }

  const label = favorite ? "Remove from favorites" : "Add to favorites";

  return <div className={cn("relative", placement === "card" && "absolute right-8 top-8 z-20")}>
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      aria-pressed={favorite}
      title={label}
      disabled={pending}
      onClick={toggleFavorite}
      className={cn(
        "size-10 border shadow-sm backdrop-blur-md",
        placement === "card" ? "border-white/20 bg-black/20 text-white hover:bg-black/35 hover:text-white" : "border-white/15 bg-white/10 text-white hover:bg-white/20 hover:text-white",
      )}
    >
      <Heart className={cn("size-4.5", favorite && "fill-coral text-coral")} />
    </Button>
    {error && <span role="alert" className="absolute right-0 top-12 w-44 rounded-lg bg-red-700 px-2.5 py-2 text-center text-[11px] leading-4 text-white shadow-lg">{error}</span>}
  </div>;
}
