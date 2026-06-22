import { NextResponse } from "next/server";

// Lightweight liveness/readiness probe for the deploy platform's healthcheck.
// Responds 200 as soon as the server is up — deliberately no DB or external
// calls, so a slow/unavailable dependency can't make the deploy healthcheck
// fail (a common cause of "container failed to start" deploy errors).
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(
    { status: "ok", uptime: process.uptime() },
    { status: 200 },
  );
}

// Some platforms probe with HEAD — answer those too.
export function HEAD() {
  return new Response(null, { status: 200 });
}
