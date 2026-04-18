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
