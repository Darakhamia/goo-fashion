/**
 * The visitor's IP address, for per-IP rate limits and the country lookup.
 *
 * Coolify's Traefik puts the address it was connected from into
 * X-Forwarded-For. With Cloudflare in front (docs/CLOUDFLARE.md) that address
 * is a Cloudflare edge, shared by thousands of visitors, and the visitor's own
 * is in CF-Connecting-IP. That header is believed only when the hop Traefik saw
 * — the last X-Forwarded-For entry, which a client cannot forge — is
 * Cloudflare's: anyone reaching the server directly could otherwise name any
 * address and dodge every per-IP limit.
 */

// https://www.cloudflare.com/ips-v4 and /ips-v6 (checked 2026-10-17). The list
// has not changed in years; an edge missing from it only makes those visitors
// share a limit, as before this file.
const CLOUDFLARE_V4 = [
  "173.245.48.0/20",
  "103.21.244.0/22",
  "103.22.200.0/22",
  "103.31.4.0/22",
  "141.101.64.0/18",
  "108.162.192.0/18",
  "190.93.240.0/20",
  "188.114.96.0/20",
  "197.234.240.0/22",
  "198.41.128.0/17",
  "162.158.0.0/15",
  "104.16.0.0/13",
  "104.24.0.0/14",
  "172.64.0.0/13",
  "131.0.72.0/22",
];
const CLOUDFLARE_V6 = [
  "2400:cb00::/32",
  "2606:4700::/32",
  "2803:f800::/32",
  "2405:b500::/32",
  "2405:8100::/32",
  "2a06:98c0::/29",
  "2c0f:f248::/32",
];

function v4ToBigInt(ip: string): bigint | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = BigInt(0);
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p) || Number(p) > 255) return null;
    n = (n << BigInt(8)) | BigInt(Number(p));
  }
  return n;
}

function v6ToBigInt(ip: string): bigint | null {
  if (!ip.includes(":") || ip.includes(".")) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  let n = BigInt(0);
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
    n = (n << BigInt(16)) | BigInt(parseInt(g, 16));
  }
  return n;
}

function inRanges(ip: string, ranges: string[], toBigInt: (s: string) => bigint | null, bits: number): boolean {
  const n = toBigInt(ip);
  if (n === null) return false;
  return ranges.some((cidr) => {
    const [base, len] = cidr.split("/");
    const b = toBigInt(base);
    if (b === null) return false;
    const shift = BigInt(bits - Number(len));
    return n >> shift === b >> shift;
  });
}

export function isCloudflareIp(ip: string): boolean {
  return inRanges(ip, CLOUDFLARE_V4, v4ToBigInt, 32) || inRanges(ip, CLOUDFLARE_V6, v6ToBigInt, 128);
}

/** The visitor's address; "127.0.0.1" when there is no proxy in front (local dev). */
export function clientIp(req: Request): string {
  const hops = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const viaCloudflare = req.headers.get("cf-connecting-ip")?.trim();
  const lastHop = hops[hops.length - 1];
  if (viaCloudflare && lastHop && isCloudflareIp(lastHop)) return viaCloudflare;
  return hops[0] ?? req.headers.get("x-real-ip")?.trim() ?? "127.0.0.1";
}
