import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { isLocalMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  applicationName: "TripNest",
  title: { default: "TripNest — Keep the journey, beautifully", template: "%s · TripNest" },
  description: "A private home for every original photo, video, and document from your trips.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "TripNest", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};
export const viewport: Viewport = { themeColor: "#1d2724", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><AuthProvider enabled={!isLocalMode}>{isLocalMode && <div className="bg-ink px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[.13em] text-white">Local demo provider · files are stored in a development-only simulator</div>}{children}</AuthProvider></body></html>;
}
