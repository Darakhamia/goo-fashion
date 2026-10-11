/**
 * Which addresses our server may fetch.
 *
 * The parser no longer fetches store pages — the extension opens them in the
 * admin's browser. What the server still downloads is photos and pictures by
 * address (product photo copying, the admin's upload-by-URL, outfit images),
 * and every such address passes these checks first, so a URL pointing at our
 * own network is refused rather than dialled.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * An IPv4 address as a 32-bit number, in any spelling `inet_aton` accepts:
 * dotted, or one to three parts with the last one filling the remaining bytes
 * ("127.1", "2130706433"), each part decimal, octal ("0177") or hex ("0x7f").
 * Null when the name is not all numbers; NaN when it is, but no address.
 */
function ipv4Value(h: string): number | null {
  const parts = h.split(".");
  if (parts.length > 4) return null;
  const nums: number[] = [];
  for (const part of parts) {
    if (/^0x[0-9a-f]*$/.test(part)) nums.push(part.length > 2 ? parseInt(part.slice(2), 16) : 0);
    else if (/^0[0-7]+$/.test(part)) nums.push(parseInt(part, 8));
    else if (/^(0|[1-9]\d*)$/.test(part)) nums.push(Number(part));
    else return null;
  }
  const last = nums.pop()!;
  if (nums.some((n) => n > 255) || last >= 256 ** (4 - nums.length)) return NaN;
  return nums.reduce((v, n, i) => v + n * 256 ** (3 - i), 0) + last;
}

function isBlockedIPv4(v: number): boolean {
  const a = Math.floor(v / 2 ** 24);
  const b = Math.floor(v / 2 ** 16) % 256;
  return (
    a === 0 || // "this network", 0.0.0.0
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local + cloud metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224 // multicast, reserved, broadcast
  );
}

/** The eight 16-bit groups of an IPv6 literal (brackets already off), or null. */
function ipv6Groups(h: string): number[] | null {
  let s = h.split("%")[0]; // zone id: "fe80::1%eth0"
  // A trailing dotted quad ("::ffff:10.0.0.1") is the last two groups.
  const quad = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (quad) {
    const v = ipv4Value(quad[2]);
    if (v === null || Number.isNaN(v)) return null;
    s = `${quad[1]}${Math.floor(v / 65536).toString(16)}:${(v % 65536).toString(16)}`;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const gap = 8 - head.length - tail.length;
  if (halves.length === 2 ? gap < 1 : gap !== 0) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? gap : 0).fill("0"), ...tail];
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => parseInt(g, 16));
}

function isBlockedIPv6(h: string): boolean {
  const g = ipv6Groups(h);
  // A colon rules out a name, and this is no address either: nothing to dial.
  if (!g) return true;
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  const embedded = g[6] * 65536 + g[7];
  if (zeros(6)) return true; // ::, ::1 and the deprecated IPv4-compatible ::a.b.c.d
  // IPv4-mapped (::ffff:a.b.c.d) and -translated (::ffff:0:a.b.c.d): the IPv4
  // address inside is what gets dialled.
  if (zeros(4) && ((g[4] === 0 && g[5] === 0xffff) || (g[4] === 0xffff && g[5] === 0))) {
    return isBlockedIPv4(embedded);
  }
  // NAT64 (64:ff9b::a.b.c.d) and 6to4 (2002:AABB:CCDD::) reach an IPv4 address too.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) {
    return isBlockedIPv4(embedded);
  }
  if (g[0] === 0x2002) return isBlockedIPv4(g[1] * 65536 + g[2]);
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated)
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  return false;
}

/**
 * Block fetches to internal / loopback / link-local addresses (SSRF defence).
 *
 * The name is normalised first, since one internal address has many
 * spellings: `new URL()` keeps an IPv6 literal in brackets ("[::1]") and a
 * trailing dot ("localhost."), and a raw hostname can still carry the numeric
 * IPv4 forms a URL parser would have folded ("2130706433", "0x7f.1"). DNS is
 * not resolved here: a public name that points at a private address passes —
 * `isBlockedResolvedHost` below is the check that resolves it.
 */
export function isBlockedDirectHost(hostname: string): boolean {
  let h = hostname.trim().toLowerCase();
  if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
  h = h.replace(/\.+$/, "");
  if (!h) return true;

  if (h.includes(":")) return isBlockedIPv6(h);

  const v4 = ipv4Value(h);
  if (v4 !== null) return Number.isNaN(v4) || isBlockedIPv4(v4);

  if (
    h === "localhost" || h.endsWith(".localhost") ||
    h === "ip6-localhost" || h === "ip6-loopback" || h.endsWith(".localdomain") ||
    h.endsWith(".internal") || h.endsWith(".local") || h.endsWith(".home.arpa")
  ) {
    return true;
  }
  // A name with no dot is never a store: it is a container or a machine on our
  // own network ("kong", "supabase-db"), reached through the resolver's search
  // list.
  return !h.includes(".");
}

/** Validate a target URL is a fetchable public http(s) resource. */
export function validateTargetUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { error: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { error: "Only http(s) URLs are supported" };
  }
  if (isBlockedDirectHost(url.hostname)) {
    return { error: "Refusing to fetch a private/internal host directly" };
  }
  return { url };
}

/**
 * `isBlockedDirectHost` plus what the name resolves to.
 *
 * The spelling check passes any public-looking name, and a name is free to
 * point anywhere: "169.254.169.254.nip.io", "lvh.me" or a domain with an A
 * record on 10.x all read as public and dial an internal address. So a name
 * (not a literal, which the spelling check already judged) is looked up, and
 * refused when any address it answers with would be refused as a literal —
 * or when it does not resolve at all, since then there is nothing to fetch.
 *
 * Asked right before each request and each redirect hop. It does not pin the
 * address fetch() then dials, so a resolver that changes its answer in between
 * (DNS rebinding) is not covered by this alone.
 */
export async function isBlockedResolvedHost(hostname: string): Promise<boolean> {
  if (isBlockedDirectHost(hostname)) return true;
  const h = hostname.trim().toLowerCase().replace(/\.+$/, "");
  // Literals were judged above: an IPv6 one in brackets, an IPv4 one in any spelling.
  if (h.startsWith("[") || isIP(h) || ipv4Value(h) !== null) return false;
  try {
    const answers = await lookup(h, { all: true, verbatim: true });
    return answers.length === 0 || answers.some((a) => isBlockedDirectHost(a.address));
  } catch {
    return true;
  }
}

/**
 * Throw unless the server may fetch `raw` directly: a public http(s) address
 * whose name resolves only to public addresses.
 */
export async function assertPublicUrl(raw: string): Promise<void> {
  const valid = validateTargetUrl(raw);
  if ("error" in valid) throw new Error(valid.error);
  if (await isBlockedResolvedHost(valid.url.hostname)) {
    throw new Error("Refusing to fetch a host that resolves to a private/internal address");
  }
}
