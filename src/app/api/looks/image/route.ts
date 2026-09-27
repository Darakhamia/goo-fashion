import { NextResponse } from "next/server";
import { checkNamedRateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Hand a look's photo back as a download.
 *
 * The obvious version — `<a href={imageUrl} download>` — does not work, and
 * fails in a way that looks deliberate: the `download` attribute is ignored on
 * a cross-origin link, so the browser navigates to the picture instead of
 * saving it. Look photos live on the storage host, never on the site's own
 * origin, so `download` was never going to apply to any of them.
 *
 * Fetching the bytes through here makes the response same-origin, and
 * `Content-Disposition: attachment` says outright what it is for. The caller
 * then saves it from a blob, which is what the admin card export already does.
 */

/** Where Storage serves public objects — the only thing on our Supabase host a look photo can be. */
const PUBLIC_OBJECTS = "/storage/v1/object/public/";

/**
 * Downloads per IP per minute. The route takes no sign-in, and a person saves
 * a photo now and then; a script walking a list of URLs through it does not.
 */
const DOWNLOADS_PER_MINUTE = 60;

/**
 * The one answer for anything that goes wrong. Separate texts for "could not
 * connect", "answered 404" and "not an image" told a caller which ports and
 * paths answer on the hosts behind the allow-list; the usual real cause is a
 * Replicate URL that has expired, about an hour after it was made.
 */
const UNAVAILABLE = "Could not download the photo — it may no longer be available.";

const fail = (status: number) => NextResponse.json({ error: UNAVAILABLE }, { status });

/** Our own Supabase URL(s): where generated photos are persisted. */
function supabaseUrls(): URL[] {
  const urls: URL[] = [];
  for (const value of [process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!value) continue;
    try {
      urls.push(new URL(value));
    } catch {
      // A malformed env var must not take the route down with it.
    }
  }
  return urls;
}

/**
 * Only ever fetch from the places our own generated photos live: Replicate's
 * delivery CDN, and the public objects of our own Storage.
 *
 * https on its default port only. The Supabase host is our own server, so any
 * other port on it would be a way to reach services the edge firewall never
 * exposes; and on that host only the public-object path is a photo at all.
 */
function isAllowed(target: URL): boolean {
  const publicObject = target.pathname.startsWith(PUBLIC_OBJECTS);
  // Storage at exactly the configured origin — in local development that is
  // plain http on its own port, which the rule below would refuse.
  if (supabaseUrls().some((u) => u.origin === target.origin)) return publicObject;
  if (target.protocol !== "https:" || target.port !== "") return false;
  const host = target.hostname.toLowerCase();
  const on = (allowed: string) => host === allowed || host.endsWith(`.${allowed}`);
  if (on("replicate.delivery")) return true;
  return supabaseUrls().some((u) => on(u.hostname)) && publicObject;
}

/** A filename the operating system will accept, derived from the URL's path. */
function filenameFor(target: URL): string {
  const last = target.pathname.split("/").filter(Boolean).pop() ?? "";
  const safe = last.replace(/[^a-zA-Z0-9._-]/g, "").slice(-60);
  if (/\.(jpe?g|png|webp|avif)$/i.test(safe)) return `goo-look-${safe}`;
  return `goo-look-${Date.now()}.jpg`;
}

export async function GET(req: Request) {
  const limit = await checkNamedRateLimit(req, {
    name: "look-image",
    requests: DOWNLOADS_PER_MINUTE,
    window: "1 m",
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many downloads. Try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const raw = new URL(req.url).searchParams.get("url") ?? "";

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return fail(400);
  }

  // An unrestricted fetcher would let anyone use the server to reach hosts the
  // browser cannot, including addresses inside our own network. The allow-list
  // is what keeps this a download button rather than a proxy.
  if (!isAllowed(target)) return fail(400);

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      // A redirect would take the request off the allow-list it just passed.
      redirect: "error",
    });
  } catch {
    return fail(502);
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !upstream.body || !type.startsWith("image/")) {
    upstream.body?.cancel().catch(() => undefined);
    return fail(502);
  }

  const length = upstream.headers.get("content-length");

  return new Response(upstream.body, {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `attachment; filename="${filenameFor(target)}"`,
      ...(length ? { "Content-Length": length } : {}),
      "Cache-Control": "private, no-store",
    },
  });
}
