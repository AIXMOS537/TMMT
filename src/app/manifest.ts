import type { MetadataRoute } from "next";

// Web app manifest — makes the app installable on any device (home-screen icon,
// standalone window). Served at /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TMMT × AIXMOS — Operations",
    short_name: "TMMT",
    description: "Run TMMT, AIXMOS & Moe Legacy from any device.",
    start_url: "/",
    display: "standalone",
    background_color: "#0A1628",
    theme_color: "#0A1628",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
