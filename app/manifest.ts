import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TripNest",
    short_name: "TripNest",
    description: "A private home for every original photo, video, and document from your trips.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f7f2e8",
    theme_color: "#1d2724",
    orientation: "any",
    categories: ["travel", "photo", "productivity"],
    lang: "en",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [{ name: "Your journeys", short_name: "Journeys", url: "/dashboard", icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }] }],
    prefer_related_applications: false,
  };
}
