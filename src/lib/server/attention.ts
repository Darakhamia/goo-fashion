import type { ServiceCheck } from "@/lib/server/system-health";

/*
 * "Needs attention" on the dashboard (GS1-2, ADMIN_DESIGN 5.5): what is broken
 * or waits for a person, each with its number and the section to fix it in.
 *
 * Built from what the dashboard has already read — the service probes, the
 * schema check, the subscriptions, a few counts — so the list costs no request
 * of its own. Items carry a key, numbers and dates; the page words them in the
 * admin's language. Errors first, then warnings. An empty list is "All good".
 *
 * Not here yet, on purpose: open Audit issues and duplicates. Both scan the
 * whole catalogue, too slow for every visit; they join once the scans are
 * cached (GS3-3).
 */

export type AttentionKey =
  | "cron"
  | "migrations"
  | "overdue"
  | "noCard"
  | "failedCharges"
  | "embeddings"
  | "aiCheck"
  | "pendingLooks";

export type AttentionItem = {
  key: AttentionKey;
  tone: "err" | "warn";
  count?: number;
  /** When the cron last ran, for a stale heartbeat. */
  at?: string;
  /** Where it is fixed. */
  href: string;
  /** For whoever fixes it, under "How to fix": migration files, a cron line. Code, not prose. */
  fix?: string[];
};

export type AttentionInput = {
  services: ServiceCheck[];
  /** null: the schema could not be read (the database is down — the service row says so). */
  missingMigrations: string[] | null;
  /** null while payments are off: nothing is billed, nothing can be overdue. */
  billing: { overdue: number; activeWithoutCard: number; failedCharges: number } | null;
  /** Products without a search embedding; null when the column is missing (a migration covers it). */
  withoutEmbedding: number | null;
  /** AI check fixes waiting for a decision; null before its migration. */
  aiSuggestions: number | null;
  pendingLooks: number | null;
};

export function buildAttention(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = [];

  const cron = input.services.find((s) => s.key === "cron");
  if (cron && cron.state === "err") {
    items.push({
      key: "cron",
      tone: "err",
      at: cron.at,
      href: "/goo-studio/subscriptions",
      // The task as BILLING.md "Renewal cron on Coolify" gives it.
      fix: [
        "Coolify → the app → Scheduled Tasks: billing-renew, 0 9 * * *",
        'curl -fsS --max-time 300 -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}/api/billing/cron/renew"',
        "CRON_SECRET set in the app's environment (BILLING.md)",
      ],
    });
  }

  if (input.missingMigrations && input.missingMigrations.length > 0) {
    items.push({
      key: "migrations",
      tone: "err",
      count: input.missingMigrations.length,
      href: "/goo-studio/settings#schema",
      fix: input.missingMigrations.map((m) => `supabase/migrations/${m}`),
    });
  }

  if (input.billing) {
    const { overdue, activeWithoutCard, failedCharges } = input.billing;
    if (overdue > 0) items.push({ key: "overdue", tone: "warn", count: overdue, href: "/goo-studio/subscriptions" });
    if (activeWithoutCard > 0) items.push({ key: "noCard", tone: "warn", count: activeWithoutCard, href: "/goo-studio/subscriptions" });
    if (failedCharges > 0) items.push({ key: "failedCharges", tone: "warn", count: failedCharges, href: "/goo-studio/subscriptions" });
  }

  if (input.withoutEmbedding) {
    items.push({ key: "embeddings", tone: "warn", count: input.withoutEmbedding, href: "/goo-studio/settings#embeddings" });
  }
  if (input.aiSuggestions) {
    items.push({ key: "aiCheck", tone: "warn", count: input.aiSuggestions, href: "/goo-studio/catalogue-check" });
  }
  if (input.pendingLooks) {
    items.push({ key: "pendingLooks", tone: "warn", count: input.pendingLooks, href: "/goo-studio/outfits" });
  }

  return items.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === "err" ? -1 : 1));
}
