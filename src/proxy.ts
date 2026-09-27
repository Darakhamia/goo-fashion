import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

const ADMIN_PATH = "/goo-studio";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/saved(.*)",
]);

const clerk = clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // Block direct /admin access — redirect to home silently
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Protect the secret admin panel — must be logged in AND be an admin
  if (pathname === ADMIN_PATH || pathname.startsWith(ADMIN_PATH + "/")) {
    const { userId, sessionClaims } = await auth();

    if (!userId) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(loginUrl);
    }

    const adminIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const isAdminById = adminIds.includes(userId);

    const meta = (
      sessionClaims?.metadata ?? sessionClaims?.publicMetadata
    ) as { isAdmin?: boolean } | undefined;
    const isAdminByMeta = meta?.isAdmin === true;

    if (!isAdminById && !isAdminByMeta) {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Whether a request is a browser write to our API sent from another site.
 *
 * The API authenticates by the Clerk session cookie alone, and most routes
 * parse the body with `req.json()`, which also reads a `text/plain` body — so a
 * page on any same-site host (the storage domain serves files from outside
 * sources) could POST with the admin's cookie and no CORS preflight. Browsers
 * send `Origin` on every non-GET request; `Sec-Fetch-Site` covers the rest.
 * A request with neither (curl, a server) is not a browser acting for a
 * signed-in visitor, so it passes. The billing webhook and cron are called
 * server to server and are never refused here.
 */
export function isCrossSiteApiWrite(method: string, pathname: string, headers: Headers): boolean {
  if (pathname !== "/api" && !pathname.startsWith("/api/")) return false;
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  if (pathname === "/api/billing/webhook" || pathname.startsWith("/api/billing/cron/")) return false;

  const origin = headers.get("origin");
  if (origin) {
    // The same Host the www redirect reads. "null" (a sandboxed frame, a
    // file:// page) does not parse and is refused with the rest.
    const host = (headers.get("host") ?? "").toLowerCase();
    try {
      return new URL(origin).host.toLowerCase() !== host;
    } catch {
      return true;
    }
  }
  return headers.get("sec-fetch-site") === "cross-site";
}

/**
 * Canonical host enforcement runs *before* Clerk: permanently (301) redirect
 * www → bare apex domain so the site isn't served as a duplicate on both hosts.
 * Canonical tags, robots Host, and sitemap loc all use the non-www origin.
 * Kept outside clerkMiddleware so it doesn't depend on Clerk being configured.
 */
export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    // Build the URL from scratch: behind the reverse proxy req.nextUrl carries the
    // internal port (e.g. :3000), which would leak into the redirect Location.
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${host.slice(4)}`);
    // 308 (not 301): preserves the HTTP method and body. A 301 turns a POST
    // into a bodyless GET, which would silently drop API writes (e.g. saving a
    // look) submitted from the www host.
    return NextResponse.redirect(url, 308);
  }
  // After the www redirect, so the check compares against the canonical host,
  // and before Clerk, so a refused request costs no session lookup.
  if (isCrossSiteApiWrite(req.method, req.nextUrl.pathname, req.headers)) {
    return NextResponse.json({ error: "Cross-site request refused." }, { status: 403 });
  }
  return clerk(req, event);
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
