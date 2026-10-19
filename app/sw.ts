import { Serwist, NetworkOnly, type PrecacheEntry, type SerwistGlobalConfig } from "serwist";

declare global { interface WorkerGlobalScope extends SerwistGlobalConfig { __SW_MANIFEST: (PrecacheEntry | string)[] | undefined } }
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: false,
  clientsClaim: false,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ sameOrigin }) => sameOrigin, handler: new NetworkOnly() },
  ],
  fallbacks: { entries: [{ url: "/offline.html", matcher: ({ request }) => request.destination === "document" }] },
});
serwist.addEventListeners();
