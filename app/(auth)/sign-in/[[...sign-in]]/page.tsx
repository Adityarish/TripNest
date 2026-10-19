import Link from "next/link";
import { SignIn } from "@clerk/nextjs";
import { ArrowRight } from "lucide-react";
import { isLocalMode } from "@/lib/env";
import { buttonVariants } from "@/components/ui/button";

export default function SignInPage() {
  if (!isLocalMode) return <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />;
  return <div className="rounded-[2rem] border border-ink/10 bg-white p-8 text-center shadow-xl shadow-ink/5"><p className="eyebrow">Local demo mode</p><h1 className="mt-3 font-display text-4xl">Welcome back</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-ink/55">Clerk is bypassed only in local mode. You’ll enter as the configured demo user.</p><Link href="/dashboard" className={`${buttonVariants({ variant: "coral" })} mt-7 w-full`}>Continue to your nest <ArrowRight className="size-4" /></Link></div>;
}
