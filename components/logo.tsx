import Link from "next/link";
import { MapPinCheckInside } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return <Link href="/" className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
    <span className="grid size-9 place-items-center rounded-xl bg-ink text-white shadow-sm"><MapPinCheckInside className="size-5" /></span>
    <span className="text-xl">TripNest</span>
  </Link>;
}
