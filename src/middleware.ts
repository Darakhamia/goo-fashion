import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/profile(.*)",
  "/saved(.*)",
  "/stylist(.*)",
  "/admin(.*)",
]);

const COMING_SOON = process.env.COMING_SOON === "true";
const BYPASS_KEY = process.env.BYPASS_KEY ?? "goo-preview-2026";
const COOKIE_NAME = "goo_preview";

// Routes that are always accessible even in coming-soon mode
const isPublicRoute = createRouteMatcher([
  "/coming-soon(.*)",
  "/api/unlock(.*)",
  "/api/(.*)",
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (COMING_SOON) {
    const bypassCookie = req.cookies.get(COOKIE_NAME);
    const hasBypass = bypassCookie?.value === BYPASS_KEY;

    if (!hasBypass && !isPublicRoute(req)) {
      return NextResponse.redirect(new URL("/coming-soon", req.url));
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
