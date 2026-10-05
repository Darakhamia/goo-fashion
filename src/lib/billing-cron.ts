/**
 * How to start the renewal cron: the task as BILLING.md "Renewal cron on
 * Coolify" gives it. Shown under "How to fix" on the dashboard
 * (lib/server/attention) and on Subscriptions, so both say the same thing.
 * Plain data in a neutral module, so the browser page can import it too.
 */
export const CRON_FIX = [
  "Coolify → the app → Scheduled Tasks: billing-renew, 0 9 * * *",
  'curl -fsS --max-time 300 -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}/api/billing/cron/renew"',
  "CRON_SECRET set in the app's environment (BILLING.md)",
];
