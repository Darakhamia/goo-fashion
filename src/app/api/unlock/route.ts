import { NextRequest, NextResponse } from "next/server";

const BYPASS_KEY = process.env.BYPASS_KEY ?? "goo-preview-2026";
const COOKIE_NAME = "goo_preview";

export function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const key = searchParams.get("key");
  const lock = searchParams.get("lock");

  // Remove access
  if (lock === "1") {
    const res = NextResponse.redirect(new URL("/coming-soon", req.url));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  // Grant access
  if (key === BYPASS_KEY) {
    const res = NextResponse.redirect(new URL("/", req.url));
    res.cookies.set(COOKIE_NAME, BYPASS_KEY, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  }

  return NextResponse.redirect(new URL("/coming-soon", req.url));
}
