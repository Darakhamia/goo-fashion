import type { NextConfig } from "next";

// Baseline security headers applied to every response. A strict
// Content-Security-Policy is intentionally left out here because it needs
// per-app tuning for Clerk / PostHog / Vercel inline scripts — add it once
// those origins are enumerated. These headers are safe and break nothing.
const securityHeaders = [
  // Disallow framing entirely — defends against clickjacking.
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME-type sniffing.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which can carry tokens) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Lock down powerful browser features we don't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  // Force HTTPS for two years, including subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  images: {
    // Allow images from any HTTPS domain so admins can paste any product image URL
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;
