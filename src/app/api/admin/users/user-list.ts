import { clerkClient, type User } from "@clerk/nextjs/server";

// ──────────────────────────────────────────────────────────────────────────
// Shared by the /api/admin/users routes. Clerk cannot filter by
// publicMetadata.plan or by ban state, so a filtered listing and the plan
// counts both have to walk the user list on the server.
// ──────────────────────────────────────────────────────────────────────────

/** Clerk's page-size ceiling for getUserList. */
const CLERK_PAGE = 500;
/** How many users a scan walks before it stops and reports itself partial. */
export const SCAN_CAP = 10_000;

/** Users granted admin through the ADMIN_USER_IDS env var (not revocable in the UI). */
export function envAdminIds(): string[] {
  return (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The plan as stored in Clerk publicMetadata — the same value the list shows. */
export function planOf(u: User): string {
  return ((u.publicMetadata ?? {}) as { plan?: string }).plan ?? "free";
}

export type StatusFilter = "active" | "banned" | "locked";

export function matchesStatus(u: User, status: StatusFilter | undefined): boolean {
  if (status === "banned") return u.banned;
  if (status === "locked") return u.locked;
  if (status === "active") return !u.banned && !u.locked;
  return true;
}

/**
 * Every user matching `query`, newest first, up to SCAN_CAP.
 * `truncated` is true when Clerk holds more users than were read.
 */
export async function scanUsers(
  query?: string,
): Promise<{ users: User[]; totalCount: number; truncated: boolean }> {
  const cc = await clerkClient();
  const users: User[] = [];
  let totalCount = 0;
  for (let offset = 0; offset < SCAN_CAP; offset += CLERK_PAGE) {
    const res = await cc.users.getUserList({ query, orderBy: "-created_at", limit: CLERK_PAGE, offset });
    totalCount = res.totalCount ?? users.length + res.data.length;
    users.push(...res.data);
    if (res.data.length < CLERK_PAGE) break;
  }
  return { users, totalCount, truncated: users.length < totalCount };
}
