import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

const localMode = (process.env.TRIPNEST_PROVIDER_MODE ?? (process.env.NODE_ENV === "production" ? "clerk-google" : "local")) === "local";
const productionProxy = clerkMiddleware();

export default localMode ? function localProxy(_request: NextRequest) { return; } : productionProxy;

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)", "/__clerk/(.*)"],
};
