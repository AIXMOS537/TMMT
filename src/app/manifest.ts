import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes HAILMARY installable on ANY device (phone, tablet,
 * desktop, Chromebook, Google TV, etc.). "Add to Home Screen" / "Install" opens
 * the console as a standalone app. Scoped to /hailmary.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HAILMARY",
    short_name: "HAILMARY",
    description: "Your operative assistant on every device — synced through one brain.",
    start_url: "/hailmary",
    scope: "/hailmary",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#059669",
    icons: [
      { src: "/hailmary-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/hailmary-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
