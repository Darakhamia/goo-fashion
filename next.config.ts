import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "static.nike.com",
      },
      {
        protocol: "https",
        hostname: "secure-images.nike.com",
      },
      {
        protocol: "https",
        hostname: "images.nike.com",
      },
    ],
  },
};

export default nextConfig;
