# Billing — monobank (Plata by mono)

Real subscription billing for the paid plans (Basic / Pro / Premium), with
**monthly auto-renewal**. Replaces the old demo "upgrade instantly" flow.

Checked against the code on 2026-09-26. Production runs on Coolify (own server,
nixpacks build), not on Vercel.

## How it works

1. **Checkout** — `/subscribe` → `POST /api/billing/checkout` creates a monobank
   invoice (tokenizing the card via `walletId = Clerk user id`), writes a
   `pending` row to `subscriptions` and redirects the customer to monobank's
   hosted payment page.
2. **Confirmation** — monobank POSTs to `POST /api/billing/webhook` on every
   status change. We verify the ECDSA `X-Sign` signature against
   `/api/merchant/pubkey`, and on `success` we unlock the plan in Clerk
   (`publicMetadata.plan`) and store the saved-card token in Supabase. A repeated
   `success` for the same invoice is ignored. If monobank has no saved card yet,
   the webhook logs `card_token_missing` and the daily cron retries the lookup.
3. **Auto-renewal** — once a day a **Coolify Scheduled Task** calls
   `GET /api/billing/cron/renew` (see [Renewal cron on Coolify](#renewal-cron-on-coolify)).
   It charges the saved card (`POST /api/merchant/wallet/payment`,
   `initiationKind: "merchant"`) for every `active` subscription with auto-renew
   on and a saved card whose period has ended. A failed charge sets the row to `past_due` and
   increments `failed_charges`; at 3 the row becomes `canceled` and the user is
   downgraded to free (see [Known gaps](#known-gaps-not-fixed) — the cron does not
   retry `past_due` rows).
4. **Cancel** — `/profile` → `POST /api/billing/cancel` turns off `auto_renew`.
   The cron stops charging; the plan in Clerk is left as it is.

> 💱 **Currency:** monobank acquiring charges in **UAH only** — it cannot bill
> USD/EUR directly. Plan prices live in `src/lib/plans.ts` (`PLAN_PRICE_UAH`:
> 399 / 999 / 1799 ₴). `MONOBANK_PRICE_*` env vars override them **on the server
> only**: `/plans`, `/subscribe`, `/profile` and the upgrade modal are client
> components and keep showing the defaults, so an override is charged but not
> shown — leave them unset until that is fixed. Dollar figures in the admin are approximate,
> converted with `BILLING_USD_UAH_RATE` (server-only, default 41).

## Setup checklist

1. **Run the DB migrations** in the Supabase SQL editor (or `psql`), in order:
   - `supabase-migration-subscriptions.sql` — the `subscriptions` table;
   - `supabase-migration-billing-events.sql` — the `billing_events` log. Without
     it there is no "Total earned", no cron heartbeat and no transaction log.
2. **Set env vars** in the Coolify app (see `.env.example`):
   - `MONOBANK_TOKEN` — merchant API token from https://web.monobank.ua
   - `NEXT_PUBLIC_SITE_URL` — the public origin, `https://goo-fashion.com`
     **without www** (used for the redirect and webhook URLs; www answers with a
     308 redirect). Needed at build time as well.
   - `CRON_SECRET` — random secret; the Scheduled Task sends it as
     `Authorization: Bearer`. Must be a runtime variable of the app.
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and Clerk keys (already required)
   - For alerts: `RESEND_API_KEY` (sender: `RESEND_FROM_EMAIL`, optional), and
     either `BILLING_ALERT_EMAIL` (comma-separated) or `ADMIN_USER_IDS`.
   - Optional: `MONOBANK_API_BASE`, `BILLING_USD_UAH_RATE`;
     `MONOBANK_PRICE_BASIC` / `_PRO` / `_PREMIUM` (hryvnia) — see the currency
     note above before setting them.
3. **Create the Coolify Scheduled Task** — see the next section. `vercel.json`
   also declares this cron, but that file only works on Vercel; on Coolify it
   does nothing.
4. The webhook URL is registered automatically per-invoice (`webHookUrl`), so no
   manual webhook config is needed in the monobank dashboard.

## Renewal cron on Coolify

Whether this task already exists on production cannot be seen from the code —
confirm with the CEO (or check the Renewal cron card, below).

Coolify → the app → **Scheduled Tasks** → add:

| Field | Value |
|---|---|
| Name | `billing-renew` |
| Frequency | `0 9 * * *` (once a day; 09:00 UTC is the old Vercel slot — check which timezone your Coolify server uses) |
| Container | not needed — the app is a single nixpacks container |
| Command | see below |

The task runs inside the app container, so it calls the app on localhost and
reads `CRON_SECRET` from the container's own environment:

```sh
curl -fsS --max-time 300 -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}/api/billing/cron/renew"
```

If the image has no `curl`, the same call through Node (always present):

```sh
node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/billing/cron/renew',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}).then(async r=>{console.log(r.status,await r.text());process.exit(r.ok?0:1)},e=>{console.error(e);process.exit(1)})"
```

Rules:
- **Once a day, one scheduler.** A charge that monobank leaves in
  `processing`/`hold` is not written to the row, so a second run before the
  webhook arrives charges the same card again. For the same reason make sure no
  old Vercel deployment of this repo is still running the `vercel.json` cron
  (whether one is still alive — confirm with the CEO).
- A manual run from outside is the same call:
  `curl -fsS -H "Authorization: Bearer <CRON_SECRET>" https://goo-fashion.com/api/billing/cron/renew`.
  It charges every due subscription for real.
- Mondays (UTC) the same run also emails the weekly billing summary.

What the endpoint answers:

| Status | Meaning |
|---|---|
| `200 {"ok":true, processed, results, tokenSweep, gapHours, alerts, weekly}` | Ran. A `cron_run` heartbeat row is written. |
| `401` | Wrong or missing header. If `CRON_SECRET` is not set at all, it also logs `cron_misconfigured` and emails an alert (at most once per 12 h). |
| `503 MONOBANK_TOKEN not configured` | Stops before charging; no heartbeat is written. |

### How to check that the cron works

1. **Coolify** — the task's execution log: exit code 0 and a JSON body with
   `"ok":true`. `curl -f` / the Node variant exit non-zero on 401/503, so a
   broken run shows as failed.
2. **`/goo-studio/subscriptions` → Billing health → "Renewal cron"** — the age of
   the last `cron_run` heartbeat. Green: `just now` / `Nh ago` under 36 h.
   Red: `never ran`, 36 h or more, or `unknown` (the `billing_events` table is
   missing or unreadable).
3. **The banner** at the top of the same page (above the KPI cards) appears when
   `billing_events` is readable and there is either no `cron_run` at all or the
   last one is 36 h old or more. It says renewals are stopped and asks to check
   the Coolify Scheduled Task and `CRON_SECRET`. The 36 h threshold is the same
   as the card's. The transaction log below hides `cron_run` rows; the heartbeat
   is read separately.
4. **SQL**, if needed:
   ```sql
   select created_at, detail from billing_events
   where event_type = 'cron_run' order by created_at desc limit 5;
   ```
   `detail` reads `due=… renewed=… failed=… tokenSweep=…`.
5. The first run after a gap of 36 h or more emails "Renewal cron had a Nh gap".
   A cron that never runs cannot report itself — only the card and the banner
   show that.

## Alerts

Sent by `src/lib/server/billing-alerts.ts` through Resend. Recipients:
`BILLING_ALERT_EMAIL` if set, otherwise the email addresses of the Clerk
accounts in `ADMIN_USER_IDS`. If there is no `RESEND_API_KEY` or no recipient,
the alert is printed in full to the server log (`[billing-alert] …`) instead.

| When | Sent by |
|---|---|
| `CRON_SECRET` is not set (any call to the cron), at most every 12 h | cron |
| Last heartbeat was 36 h or more ago | cron |
| Subscriptions were due and none renewed / some renewal charges failed | cron |
| An active subscription has had no saved card for 24 h or more | cron |
| A first or renewal payment failed | webhook |
| Weekly summary (Monday runs, UTC) | cron |

## Admin actions that touch billing

### Deleting a user (`/goo-studio/users`)

`DELETE /api/admin/users/[id]`:
1. Refuses to delete the super admin or yourself.
2. **Turns auto-renew off first** (`cancelAutoRenew`). If the user's row had
   auto-renew on, logs a `canceled` billing event "auto-renew disabled: account
   deleted by admin". If this step fails, the user is **not** deleted and the
   admin sees the error.
3. Deletes the Clerk account and writes `user.deleted` to the audit log (with
   the plan and whether auto-renew was turned off).

The confirm dialog (single and bulk delete) warns about this when the user has
an `active` or `past_due` subscription. The `subscriptions` row itself is kept
with its status, so it stays on the Subscriptions page (shown by user id).

### Changing a plan (`/goo-studio/users`)

Only `publicMetadata.plan` in Clerk changes. The `subscriptions` row — plan,
price, card, auto-renew — is untouched, so:
- the saved card keeps being charged the price of the subscription's plan;
- the next successful renewal writes the subscription's plan back to Clerk,
  undoing the manual change.

For users with an `active` or `past_due` subscription the drawer shows an amber
warning ("Only the plan in Clerk changes — billing does not.", plus "Charges
continue, and the next renewal restores the paid plan." when auto-renew is on),
and the bulk "set plan" confirm says the same. The audit entry
`user.plan_changed` records the old and new plan and the subscription state.
The studio has no "cancel subscription" button: to stop charges, the user
cancels in `/profile`, or the admin deletes the account.

## Subscriptions page: how the numbers are counted

Source: `GET /api/admin/subscriptions`. Money is stored in kopiykas and shown in
whole hryvnia; `≈ $` uses `BILLING_USD_UAH_RATE`.

| Card | How it is counted |
|---|---|
| Total earned | Sum of `amount` over **all** `payment_success` rows in `billing_events` (read page by page, not just the 200 shown in the log). `amount` is the plan price at the moment the payment was recorded, not monobank's settled amount. Reversals and refunds are not subtracted; payments made before `billing_events` existed are not counted. |
| Earned this month | Same, rows since the 1st of the current month, 00:00 UTC. The subline is the number of `payment_success` rows in total. |
| MRR / By plan | Sum of the row's `amount` over subscriptions with status `active` (including those with auto-renew off). |
| Active subscribers | Rows with status `active`; "N won't renew" = those with auto-renew off. |
| Past due / Canceled / Pending checkout | Row counts by status. |
| Renewal cron | Hours since the last `cron_run` (see above). |
| Active without card | `active`, auto-renew on, no card token. The renewal charge skips these; the daily cron only retries the card lookup. Should be 0. |
| Overdue | `active` rows whose `current_period_end` has passed. |
| Failed charges | Sum of `failed_charges` over `active` and `past_due` rows only. The counter is consecutive failures and resets to 0 on a successful payment; `canceled` rows are left out. Red when above 0. |
| Transaction log | The latest 200 `billing_events`, without `cron_run`. |

## Known gaps (not fixed)

Seen in the code on 2026-09-26. Fixing any of them is a separate task by CEO
decision.

1. **`past_due` is never retried.** The cron only picks `active` rows, so after
   the first failed renewal nothing charges the card again, and the user keeps
   the paid plan in Clerk. The downgrade at 3 failures is reached only if more
   `failure` webhooks arrive.
2. **One failed renewal can count twice.** The cron records the failure when
   `chargeWallet` returns it. The charge also carries `webHookUrl`, so if
   monobank then sends a `failure` webhook for the same invoice, it is recorded
   again (and a second `payment_failed` is logged) — the webhook has no
   duplicate check for failures.
3. **Cancelling does not end access.** Nothing downgrades the plan when the
   paid period ends. The row stays `active` with auto-renew off, so after the
   period it is counted in MRR and shows as Overdue. The same happens to rows
   of deleted users.
4. **Checkout by an existing subscriber** (e.g. an upgrade on `/subscribe`)
   switches their row to `pending` and the new plan before payment. If they
   abandon the payment, the row drops out of renewal while Clerk keeps the old
   paid plan.

## Files

| Path | Purpose |
|------|---------|
| `src/lib/server/monobank.ts` | API client + webhook signature verification |
| `src/lib/server/subscriptions.ts` | Supabase ledger + Clerk plan sync + `billing_events` log |
| `src/lib/server/billing-alerts.ts` | Email alerts via Resend |
| `src/lib/plans.ts` | Plans, UAH prices, display rate |
| `src/app/api/billing/checkout/route.ts` | Create invoice, redirect to monobank |
| `src/app/api/billing/webhook/route.ts` | Verify + activate / record failures |
| `src/app/api/billing/cron/renew/route.ts` | Daily renewal sweep, card-token recovery, heartbeat, alerts |
| `src/app/api/billing/cancel/route.ts` | Turn off auto-renewal |
| `src/app/api/billing/status/route.ts` | Current billing state for the profile |
| `src/app/api/admin/subscriptions/route.ts` | Data for the admin Subscriptions page |
| `src/app/goo-studio/subscriptions/page.tsx` | Admin: revenue, billing health, subscribers, transaction log |
| `src/app/api/admin/users/[id]/route.ts` | Admin: delete user (auto-renew off first), change plan |
| `supabase-migration-subscriptions.sql` | `subscriptions` table |
| `supabase-migration-billing-events.sql` | `billing_events` table |
| `vercel.json` | Cron declaration for Vercel only — not used in production |
