import type { MetadataRoute } from "next";
import { SITE_NAME } from "@/lib/seo";

/**
 * /manifest.webmanifest: the name, icon and colours a phone uses when the site
 * is added to the home screen. It answered 404 before (docs/SEO_PLAN.md, P3).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — AI Stylist & Outfit Builder`,
    short_name: "GOO",
    description:
      "One catalog of pieces from many stores, an outfit builder and an AI stylist. Compare prices and buy each piece from the original store.",
    start_url: "/",
    display: "standalone",
    // --background of the dark theme (globals.css), which a new visitor sees.
    background_color: "#0A0A0A",
    theme_color: "#0A0A0A",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
