import Link from "next/link";
import { redirect } from "next/navigation";
import { HardDrive, LayoutGrid } from "lucide-react";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { getActor, isAdmin } from "@/lib/auth/server";
import { isLocalMode } from "@/lib/env";
import { InstallAppButton } from "@/components/pwa/install-app-button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return <div className="min-h-screen"><header className="sticky top-0 z-30 border-b border-ink/7 bg-cream/90 backdrop-blur-xl"><div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 sm:px-8"><Logo /><nav className="flex items-center gap-1"><Link href="/dashboard" className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-white hover:text-ink sm:flex"><LayoutGrid className="size-4" /> Trips</Link>{isAdmin(actor.clerkUserId) ? <Link href="/admin/storage" className="hidden items-center gap-2 rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-white hover:text-ink sm:flex"><HardDrive className="size-4" /> Storage</Link> : <Link href="/storage" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-white hover:text-ink"><HardDrive className="size-4" /><span className="hidden sm:inline">My Drive</span></Link>}<InstallAppButton /><div className="ml-1 sm:ml-2"><UserMenu local={isLocalMode} /></div></nav></div></header><main className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">{children}</main></div>;
}
