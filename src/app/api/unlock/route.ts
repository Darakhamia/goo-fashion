import { NextRequest, NextResponse } from "next/server";

// Env-only — no hardcoded fallback. Without BYPASS_KEY set, unlock is disabled.
const BYPASS_KEY = process.env.BYPASS_KEY || null;
const COOKIE_NAME = "goo_preview";

function siteBase(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? new URL(req.url).host;
  return `${proto}://${host}`;
}

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const key = searchParams.get("key");
  const lock = searchParams.get("lock");
  const base = siteBase(req);

  // Remove access
  if (lock === "1") {
    const res = NextResponse.redirect(`${base}/coming-soon`);
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // Grant access
  if (BYPASS_KEY !== null && key === BYPASS_KEY) {
    const res = NextResponse.redirect(`${base}/`);
    res.cookies.set(COOKIE_NAME, BYPASS_KEY, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  }

  return NextResponse.redirect(`${base}/coming-soon`);
}
