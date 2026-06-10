import { ImageResponse } from "next/og";

/**
 * Default Open Graph / Twitter card image for all pages that don't define
 * their own (product/blog pages override with real photos). Generated at the
 * edge — no static asset needed.
 */
export const runtime = "edge";
export const alt = "GOO — AI Stylist. Curated outfits, premium fashion, one platform.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 160,
            fontWeight: 800,
            letterSpacing: "0.18em",
            display: "flex",
          }}
        >
          GOO
        </div>
        <div
          style={{
            fontSize: 42,
            marginTop: 24,
            color: "rgba(255,255,255,0.75)",
            letterSpacing: "0.08em",
            display: "flex",
          }}
        >
          Your personal AI stylist
        </div>
        <div
          style={{
            fontSize: 26,
            marginTop: 16,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: "0.04em",
            display: "flex",
          }}
        >
          Curated outfits · Premium fashion · One platform
        </div>
      </div>
    ),
    size
  );
}
