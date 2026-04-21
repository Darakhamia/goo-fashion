import { auth } from "@clerk/nextjs/server";

/**
 * Verifies the caller is an authenticated Clerk user whose ID appears in
 * the ADMIN_USER_IDS environment variable (comma-separated list).
 *
 * Returns { userId } on success, null on failure.
 * Fail-safe: if ADMIN_USER_IDS is not set or is empty, all requests are denied.
 *
 * Usage in API routes:
 *   const admin = await requireAdmin();
 *   if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function requireAdmin(): Promise<{ userId: string } | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const raw = process.env.ADMIN_USER_IDS ?? "";
  const adminIds = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (adminIds.length === 0) return null;
  if (!adminIds.includes(userId)) return null;

  return { userId };
}

/** Returns the super admin's Clerk user ID from SUPER_ADMIN_USER_ID env var. */
export function getSuperAdminId(): string | null {
  return process.env.SUPER_ADMIN_USER_ID?.trim() || null;
}

/** Returns true if the given userId is the super admin. */
export function isSuperAdminId(userId: string): boolean {
  const id = getSuperAdminId();
  return !!id && userId === id;
}

/**
 * Returns { userId } if the caller is the super admin, null otherwise.
 * Super admin must also be in ADMIN_USER_IDS.
 */
export async function requireSuperAdmin(): Promise<{ userId: string } | null> {
  const admin = await requireAdmin();
  if (!admin) return null;
  if (!isSuperAdminId(admin.userId)) return null;
  return admin;
}
