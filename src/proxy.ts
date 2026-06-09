import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATH = "/goo-studio";
// Site is live — coming-soon gate disabled. Set to `process.env.COMING_SOON === "true"` to re-enable.
const COMING_SOON = false;
const BYPASS_KEY = process.env.BYPASS_KEY ?? "goo-preview-2026";
const COOKIE_NAME = "goo_preview";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/saved(.*)",
  "/stylist(.*)",
]);

const isPublicRoute = createRouteMatcher([
  "/coming-soon(.*)",
  "/report(.*)",
  "/api/unlock(.*)",
  "/api/(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  // Block direct /admin access — redirect to home silently
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (COMING_SOON) {
    const bypassCookie = req.cookies.get(COOKIE_NAME);
    const hasBypass = bypassCookie?.value === BYPASS_KEY;

    if (!hasBypass && !isPublicRoute(req)) {
      return NextResponse.redirect(new URL("/coming-soon", req.url));
    }
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

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
