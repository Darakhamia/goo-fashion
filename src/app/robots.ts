import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Disallow only what a crawler should never fetch. Pages that merely shouldn't
 * be indexed — /cart, /subscribe, /login, /register — carry `noindex` instead
 * and stay crawlable: a page blocked here can still be indexed from links to
 * it, because the crawler never gets to read its noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/goo-studio/",
          // Signed-in only: a crawler is sent to the sign-in host.
          "/saved",
          "/profile",
          // The app itself, ~4 MB of client code with nothing to index.
          "/builder",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
