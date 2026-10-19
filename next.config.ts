import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [
    { url: "/offline.html", revision: process.env.npm_package_version ?? "1" },
    { url: "/icon-192.png", revision: process.env.npm_package_version ?? "1" },
    { url: "/icon-512.png", revision: process.env.npm_package_version ?? "1" },
    { url: "/icon-maskable-512.png", revision: process.env.npm_package_version ?? "1" },
    { url: "/apple-touch-icon.png", revision: process.env.npm_package_version ?? "1" },
  ],
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: false,
  scope: "/",
  exclude: [/.*/],
});

export default withSerwist({
  reactStrictMode: true,
  output: "standalone",
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  serverExternalPackages: ["@prisma/client", "googleapis"],
  images: { remotePatterns: [{ protocol: "https", hostname: "lh3.googleusercontent.com" }] },
  async headers() {
    return [{
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    }];
  },
});
