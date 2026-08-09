import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    turbopackUseSystemTlsCerts: true,
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
      // Supabase Storage: product mirrors, generated outfits, brand logos.
      { protocol: "https", hostname: "*.supabase.co" },
      // Replicate output, before generate-outfit persists it to Storage.
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "**.replicate.delivery" },
    ],
  },
};

export default nextConfig;
