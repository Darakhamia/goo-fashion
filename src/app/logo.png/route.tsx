import { ImageResponse } from "next/og";

/**
 * Square brand logo served at /logo.png — referenced by Organization JSON-LD
 * (Google requires a real image ≥112×112; favicon.ico doesn't qualify).
 */
export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
          color: "#ffffff",
          fontSize: 140,
          fontWeight: 800,
          letterSpacing: "0.12em",
          fontFamily: "sans-serif",
        }}
      >
        GOO
      </div>
    ),
    { width: 512, height: 512 }
  );
}
