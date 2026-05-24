import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ADMIN_PATH = "/goo-studio";

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl;

  // Block direct /admin access — redirect to home silently
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Protect the secret admin panel
  if (pathname === ADMIN_PATH || pathname.startsWith(ADMIN_PATH + "/")) {
    const { userId, sessionClaims } = await auth();

    // Must be logged in
    if (!userId) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirect_url", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Check ADMIN_USER_IDS env allow-list
    const adminIds = (process.env.ADMIN_USER_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const isAdminById = adminIds.includes(userId);

    // Check isAdmin flag in Clerk publicMetadata JWT claims
    const meta = (
      sessionClaims?.metadata ?? sessionClaims?.publicMetadata
    ) as { isAdmin?: boolean } | undefined;
    const isAdminByMeta = meta?.isAdmin === true;

    if (!isAdminById && !isAdminByMeta) {
      // Authenticated but not admin — redirect home, reveal nothing
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
