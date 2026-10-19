"use client";

import { UserButton } from "@clerk/nextjs";
import { CircleUserRound } from "lucide-react";

export function UserMenu({ local }: { local: boolean }) {
  return local ? <div className="flex items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 text-sm"><CircleUserRound className="size-4" /><span className="hidden sm:inline">Demo user</span></div> : <UserButton showName userProfileMode="modal" />;
}
