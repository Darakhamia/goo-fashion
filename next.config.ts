import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackUseSystemTlsCerts: true,
  },
  // The card export draws its type with these font files at request time, by a
  // path it builds at runtime — which the bundle tracer cannot see, so it would
  // deploy the route without them and render cards with no text at all.
  outputFileTracingIncludes: {
    "/api/admin/export-images": ["./src/assets/fonts/**"],
    // The schema check compares the migration files this build carries with the
    // ones the database has applied (lib/server/schema-check.ts), by directory.
    "/api/admin/schema-check": ["./supabase/migrations/**"],
    "/api/admin/stats": ["./supabase/migrations/**"],
    // "Apply now" runs the deploy's own script, which reads the same folder.
    "/api/admin/migrations": ["./scripts/migrate.mjs", "./supabase/migrations/**"],
  },
  // HSTS: browsers that have seen the site once go straight to https instead of
  // through the reverse proxy's http → https redirect. Apex only — no
  // includeSubDomains or preload until every subdomain is known to serve https
  // (docs/SEO_PLAN.md, SEO-10). Browsers ignore it on plain-http responses, so
  // a local `next start` is unaffected.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Strict-Transport-Security", value: "max-age=31536000" }],
      },
    ];
  },
  // The CSV import page used to live at /goo-studio/brightdata, although it
  // never talked to BrightData. Keep old bookmarks working.
  async redirects() {
    return [
      { source: "/goo-studio/brightdata", destination: "/goo-studio/import", permanent: true },
    ];
  },
  images: {
    // Only hosts we own reach the optimizer. Admins can still paste any product
    // image URL: partner CDNs are rendered `unoptimized` (see
    // components/ui/Image), so they never need a pattern here.
    //
    // This used to be `hostname: "**"`, which had two costs. Retailer CDNs
    // rate-limit the optimizer's server-side fetch and answered 429, so catalog
    // photos rendered as alt text; and `/_next/image?url=<anything>` was an open
    // proxy anyone could bill to our image-optimization quota.
    //
    // Keep in sync with OWN_IMAGE_HOSTNAME in src/lib/image.ts.
    remotePatterns: [
      // Supabase Storage: product mirrors, generated outfits, brand logos —
      // self-hosted since the move, hosted Supabase before it.
      { protocol: "https", hostname: "supabase.goo-fashion.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      // Replicate output, before generate-outfit persists it to Storage.
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "**.replicate.delivery" },
    ],
  },
};

export default nextConfig;
