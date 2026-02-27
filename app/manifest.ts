import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Phoenix Ops",
    short_name: "Phoenix Ops",
    description: "Planning terrain Phoenix Nouvelle-Aquitaine",
    start_url: "/?pwa=v6",
    scope: "/",
    display: "standalone",
    background_color: "#183536",
    theme_color: "#183536",
    icons: [
      { src: "/icon-192.png?v=6", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png?v=6", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png?v=6", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png?v=6", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}