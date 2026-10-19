"use client";

import { ClerkProvider } from "@clerk/nextjs";

export function AuthProvider({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  return enabled ? <ClerkProvider>{children}</ClerkProvider> : children;
}
