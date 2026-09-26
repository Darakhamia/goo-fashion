import { clerkClient } from "@clerk/nextjs/server";
import { supabase } from "@/lib/supabase";

export type AdminAction =
  | "user.name_updated"
  | "user.plan_changed"
  | "user.admin_granted"
  | "user.admin_revoked"
  | "user.banned"
  | "user.unbanned"
  | "user.deleted"
  | "settings.api_key_updated"
  | "settings.api_key_deleted"
  | "settings.homepage_showcase_updated"
  | "settings.homepage_stylist_updated"
  | "settings.prompt_updated"
  | "settings.prompt_reset"
  | "parser.config_updated"
  | "parser.product_imported"
  | "parser.crawl_batch"
  | "parser.collect_ingest"
  | "categories.updated"
  | "products.created"
  | "products.updated"
  | "products.deleted"
  | "products.bulk_deleted"
  | "products.recategorized"
  | "products.recategorize_undone"
  | "products.label_fixed"
  | "products.label_dismissed"
  | "products.label_restored"
  | "products.bulk_edited"
  | "products.bg_color_sampled"
  | "products.bg_color_undone"
  | "products.duplicates_merged"
  | "products.duplicates_dismissed"
  | "outfits.created"
  | "outfits.updated"
  | "outfits.deleted"
  | "looks.approved"
  | "looks.rejected"
  | "blog.created"
  | "blog.updated"
  | "blog.deleted"
  | "brands.created"
  | "brands.deleted"
  | "brands.logo_updated"
  | "brands.logo_removed"
  | "retailer_domain.saved"
  | "retailer_domain.deleted"
  | "retailer_domain.applied"
  | "import.csv"
  | "stylist_usage.reset"
  | "email.sent"
  | "waitlist.deleted";

interface AuditEntry {
  admin_id: string;
  /** Looked up in Clerk by admin_id when not passed. */
  admin_email?: string | null;
  action: AdminAction;
  target_id?: string;
  target_type?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Admin emails looked up for the log, kept a few minutes: the studio's bulk
 * delete calls DELETE /api/products/[id] once per product, and each would
 * otherwise ask Clerk for the same admin's email again.
 */
const EMAIL_TTL_MS = 5 * 60 * 1000;
const emailCache = new Map<string, { email: string; at: number }>();
/** Lookups under way, so a burst of actions by one admin asks Clerk once. */
const emailLookups = new Map<string, Promise<string | undefined>>();

/**
 * How long an action's response waits for the email. The callers await the
 * log, so a slow Clerk would hold a saved product's response open until the
 * admin gives up and saves it again. Past this the entry goes without the
 * email (the Activity page fills it in on read); the lookup carries on and
 * warms the cache for the next one.
 */
const EMAIL_WAIT_MS = 2_000;

async function adminEmail(adminId: string): Promise<string | undefined> {
  const hit = emailCache.get(adminId);
  if (hit && Date.now() - hit.at < EMAIL_TTL_MS) return hit.email;
  let lookup = emailLookups.get(adminId);
  if (!lookup) {
    lookup = resolveAdminEmails([adminId])
      .then((emails) => {
        const email = emails.get(adminId);
        if (email) emailCache.set(adminId, { email, at: Date.now() });
        return email;
      })
      .finally(() => emailLookups.delete(adminId));
    emailLookups.set(adminId, lookup);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => resolve(undefined), EMAIL_WAIT_MS);
  });
  try {
    return await Promise.race([lookup, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Write an admin action to the audit log. Never throws: a failed write is
 * reported with console.error and the caller's response goes on regardless.
 */
export async function logAdminAction(entry: AuditEntry): Promise<void> {
  if (!supabase) return;
  try {
    const email = entry.admin_email || (await adminEmail(entry.admin_id));
    const { error } = await supabase.from("admin_audit_log").insert({
      admin_id: entry.admin_id,
      admin_email: email ?? null,
      action: entry.action,
      target_id: entry.target_id ?? null,
      target_type: entry.target_type ?? null,
      metadata: entry.metadata ?? {},
    });
    if (error) console.error(`[audit] could not record ${entry.action}: ${error.message}`);
  } catch (e) {
    // Audit log failure is non-critical — never block the main response.
    console.error(`[audit] could not record ${entry.action}:`, e);
  }
}

/**
 * Emails of several Clerk users, looked up in one call. Users Clerk does not
 * know (deleted accounts) or cannot be reached for are simply left out.
 */
export async function resolveAdminEmails(ids: string[]): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  // Clerk's user list takes at most 500 ids per call.
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 500);
  if (unique.length === 0) return emails;
  try {
    const cc = await clerkClient();
    const { data } = await cc.users.getUserList({ userId: unique, limit: unique.length });
    for (const u of data) {
      const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress;
      if (email) emails.set(u.id, email);
    }
  } catch (e) {
    console.error("[audit] could not look up admin emails in Clerk:", e);
  }
  return emails;
}
