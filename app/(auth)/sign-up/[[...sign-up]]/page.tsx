import Link from "next/link";
import { SignUp } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { isLocalMode } from "@/lib/env";
import { buttonVariants } from "@/components/ui/button";

export default function SignUpPage() {
  if (!isLocalMode) return <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />;
  return <div className="rounded-[2rem] border border-ink/10 bg-white p-8 text-center shadow-xl shadow-ink/5"><p className="eyebrow">Local demo mode</p><h1 className="mt-3 font-display text-4xl">Your nest is ready</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-ink/55">Production sign-up uses Clerk email or Google login. This credential-free demo uses a local identity.</p><Link href="/dashboard" className={`${buttonVariants({ variant: "coral" })} mt-7 w-full`}>Explore TripNest <ArrowRight className="size-4" /></Link></div>;
}
