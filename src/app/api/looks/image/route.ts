import { NextResponse } from "next/server";

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

/** Only ever fetch from the places our own generated photos live. */
function allowedHosts(): string[] {
  const hosts = ["replicate.delivery"];
  for (const value of [process.env.SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_URL]) {
    if (!value) continue;
    try {
      hosts.push(new URL(value).hostname);
    } catch {
      // A malformed env var must not take the route down with it.
    }
  }
  return hosts;
}

function isAllowed(target: URL): boolean {
  if (target.protocol !== "https:" && target.protocol !== "http:") return false;
  const host = target.hostname.toLowerCase();
  return allowedHosts().some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** A filename the operating system will accept, derived from the URL's path. */
function filenameFor(target: URL): string {
  const last = target.pathname.split("/").filter(Boolean).pop() ?? "";
  const safe = last.replace(/[^a-zA-Z0-9._-]/g, "").slice(-60);
  if (/\.(jpe?g|png|webp|avif)$/i.test(safe)) return `goo-look-${safe}`;
  return `goo-look-${Date.now()}.jpg`;
}

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url") ?? "";
  if (!raw) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Not a URL" }, { status: 400 });
  }

  // An unrestricted fetcher would let anyone use the server to reach hosts the
  // browser cannot, including addresses inside our own network. The allow-list
  // is what keeps this a download button rather than a proxy.
  if (!isAllowed(target)) {
    return NextResponse.json({ error: "That image is not on a known host" }, { status: 400 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ error: "Could not fetch the image" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    // The usual cause is a Replicate URL that has expired — about an hour after
    // it was made — so say that rather than a bare status code.
    return NextResponse.json(
      { error: `The image is no longer available (${upstream.status}).` },
      { status: 502 },
    );
  }

  const type = upstream.headers.get("content-type") ?? "";
  if (!type.startsWith("image/")) {
    return NextResponse.json({ error: "That link is not an image" }, { status: 400 });
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
