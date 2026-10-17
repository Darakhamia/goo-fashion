# Billing — monobank (Plata by mono)

Real subscription billing for the paid plans (Basic / Pro / Premium), with
**monthly auto-renewal**.

Checked against the code on 2026-10-14. Production runs on Coolify (own server,
nixpacks build). The old Vercel deployment is gone (confirmed by the CEO on
2026-09-27) and `vercel.json` was deleted, so the Coolify Scheduled Tasks below
are the only scheduler there is.

**2026-10-14, CEO decision:** checkout moved to monobank's own subscription
(«Регулярні платежі»), the scheme the CEO's other project uses. The bank charges
the card every month by itself; the invoice + saved card flow stays as the
fallback. Before this, a plan was renewed only if the bank had saved the card,
which in practice it did not (see [Known gaps](#known-gaps-not-fixed)).

## How it works

The card never reaches us. The customer types it on monobank's page
(`pay.mbnk.biz`); we create a subscription or an invoice, send the customer to
its `pageUrl` and then find out what happened.

Three roads, tried in this order. The road is chosen by monobank's answer, not
by a setting: every click on a plan first asks for a subscription.

| Road | monobank method | When | Who keeps the schedule |
|---|---|---|---|
| 1. Bank subscription | `POST /api/merchant/subscription/create` | always tried first | the bank |
| 2. One-off invoice | `POST /api/merchant/invoice/create` | the bank refuses a subscription (`errCode 1001` or "h2h not allowed"), or migration 028 is missing | nobody: renewal only through road 3 |
| 3. Saved card | `POST /api/merchant/wallet/payment` | road 2 was paid and the bank saved the card | our daily cron |

### Road 1 — bank subscription

1. **Checkout** — `/subscribe` → `POST /api/billing/checkout`. A row goes into
   `mono_subscriptions` with the frozen terms (plan, amount, interval `1m`) and
   the **sha256 of a random secret**, then monobank is asked for a subscription
   whose `chargeUrl` / `statusUrl` are
   `/api/billing/subscription/<secret>/charge|status`. monobank's create call has
   no field for our own id, so the secret in the URL is how we know whose
   subscription it is. The hash is written before the bank is called; if the
   bank answers but our write fails, the subscription is invalidated at once
   (`subscription/remove`) so it can never charge someone we cannot find.
2. **Payment** — the customer pays on monobank's page; from then on the bank
   charges every month by itself.
3. **Knock** — after every charge, and when the subscription's state changes,
   monobank POSTs to one of those URLs. The body is **not read**: monobank
   documents neither its fields nor a signature, so it proves nothing. The knock
   only means "ask now": we call `subscription/payments` and
   `subscription/status` with our own token.
4. **Recording** — each charge is recorded by one database function,
   `goo_record_mono_charge()` (migration 028): it inserts the charge, keyed by
   *subscription + moment of the charge to the second* (a charge has no id of
   its own), and extends the paid period in the same transaction. A repeated
   knock is turned away by that key. A charge counts only in UAH and not below
   the frozen amount — the bank charges what the customer agreed to, even if
   the price has changed since; anything else is logged as `ledger_error` and
   emailed, and the period is not extended.
5. **Plan** — on a counted charge the plan is set in Clerk
   (`publicMetadata.plan`). The ledger row in `subscriptions` gets
   `mono_subscription_id`; the renewal cron never charges a card on such a row.
6. **Plan change** — monobank cannot change a subscription's amount
   (`subscription/edit` only cancels), so an upgrade is a new subscription. When
   the new one's first charge comes in, the old one is cancelled at the bank.
   The customer types the card again.
7. **Cancel** — `/profile` → `POST /api/billing/cancel` →
   `subscription/edit {subscriptionId, action: "cancel"}`, **never with
   `refundAmount`** (with it the call also refunds money). It counts as
   cancelled only once the bank says yes. The plan stays until the paid period
   ends; then the sync sets it back to free — unless an admin has set a
   different plan by hand in the meantime, which is left alone.
8. **Reconciliation** — knocks get lost, so `GET /api/billing/cron/sync` syncs
   every live subscription **hourly**: unseen charges, cancellations by the
   customer or by the bank (after a failed charge), unpaid payment pages older
   than 48 h (invalidated at the bank), plans whose paid period has run out
   after a cancellation. The customer coming back from the payment page also
   triggers a sync of their own subscription (`POST /api/billing/sync`, at most
   every 15 s per subscription), so the plan switches on without waiting for
   the knock.

### Roads 2 and 3 — invoice and saved card

1. **Checkout** — when the bank refuses a subscription, the same click creates
   a monobank invoice (tokenizing the card via `walletId = Clerk user id`),
   writes a `pending` row to `subscriptions` and redirects to monobank's page.
2. **Confirmation** — monobank POSTs to `POST /api/billing/webhook` on every
   status change. We verify the ECDSA `X-Sign` signature against
   `/api/merchant/pubkey`, and on `success` we unlock the plan in Clerk and
   store the saved-card token. A repeated `success` for the same invoice is
   ignored. If monobank has no saved card yet, the webhook logs
   `card_token_missing` and the daily cron retries the lookup. An invoice still
   `pending` after a lost webhook is picked up by the hourly sync
   (`invoice/status`).
3. **Auto-renewal** — once a day `GET /api/billing/cron/renew` charges the
   saved card (`initiationKind: "merchant"`) for every `active` subscription
   with auto-renew on and a saved card whose period has ended. A failed charge
   sets the row to `past_due` and increments `failed_charges`; at 3 the row
   becomes `canceled` and the user is downgraded to free.
4. **Cancel** — `POST /api/billing/cancel` turns off `auto_renew`. The cron
   stops charging; the plan in Clerk is left as it is.

The card is saved only if monobank switched tokenization on for the merchant.
Without it road 2 is a single month.

> 💱 **Currency:** monobank acquiring charges in **UAH only** — it cannot bill
> USD/EUR directly. Plan prices live in `src/lib/plans.ts` (`PLAN_PRICE_UAH`:
> 399 / 999 / 1799 ₴). `MONOBANK_PRICE_*` env vars override them **on the server
> only**: `/plans`, `/subscribe`, `/profile` and the upgrade modal are client
> components and keep showing the defaults, so an override is charged but not
> shown — leave them unset until that is fixed. Dollar figures in the admin are approximate,
> converted with `BILLING_USD_UAH_RATE` (server-only, default 41).

## Setup checklist

### 1. monobank business cabinet

1. **A terminal of its own for goo-fashion.** monobank issues a terminal for a
   specific site. One terminal and one token per site; never share a token
   with another project — revoking it there stops payments here (this is what
   happened in October 2026). See [Several sites](#several-sites).
2. **The token.** https://web.monobank.ua → Plata by mono → API tokens, for
   the goo-fashion terminal.
3. **Ask monobank's support** (чат у застосунку / «служба турботи») to switch
   on, for this terminal: **subscriptions** («регулярні платежі») — road 1; and
   **tokenization** (saving cards) — needed only for road 3. Both are off by
   default. Without subscriptions every checkout falls back to an invoice and
   nothing renews unless tokenization is on.
4. If monobank gives a **separate token for subscriptions**, keep it: it goes
   into `MONOBANK_SUB_TOKEN`. If it switches subscriptions on for the main
   token, one token is enough.

### 2. Database

Migration `028_monobank_subscriptions.sql` (bank subscriptions) is applied by
the deploy itself (README, «Деплой»). Settings → Database schema shows whether
it went in; without it checkout uses invoices only. Migration
`029_subscription_billing_interval.sql` adds the period of a plan
(`subscriptions.billing_interval`) for the [test subscription](#test-subscription);
without it everything else works and only that test answers with an error.

The two root files are the starting schema, not numbered migrations, so the
deploy does not apply them; on production they already exist:
- `supabase-migration-subscriptions.sql` — the `subscriptions` table;
- `supabase-migration-billing-events.sql` — the `billing_events` log. Without
  it there is no "Total earned", no cron heartbeat and no transaction log.

### 3. Env vars in Coolify (see `.env.example`)

- `MONOBANK_TOKEN` — the goo-fashion terminal's token. Invoices, saved cards,
  webhook signature key. Without it payments are off: checkout answers 503,
  the dashboard shows monobank and the cron as grey "Off".
- `MONOBANK_SUB_TOKEN` — optional, the subscription token if monobank issued a
  separate one; otherwise `MONOBANK_TOKEN` is used for subscriptions too.
- `NEXT_PUBLIC_SITE_URL` — the public origin, `https://goo-fashion.com`
  **without www** (used for the redirect and all webhook URLs; www answers
  with a 308 redirect). Needed at build time as well.
- `CRON_SECRET` — random secret; both Scheduled Tasks send it as
  `Authorization: Bearer`. Must be a runtime variable of the app.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and Clerk keys (already required)
- For alerts: `RESEND_API_KEY` (sender: `RESEND_FROM_EMAIL`, optional), and
  either `BILLING_ALERT_EMAIL` (comma-separated) or `ADMIN_USER_IDS`.
- Optional: `MONOBANK_API_BASE`, `BILLING_USD_UAH_RATE`;
  `MONOBANK_PRICE_BASIC` / `_PRO` / `_PREMIUM` (hryvnia) — see the currency
  note above before setting them.

Env changes take effect after a redeploy.

### 4. Scheduled Tasks in Coolify

Two tasks — see the next section. There is no other scheduler.

### 5. Check

1. `/goo-studio` → System health: **monobank** green (it asks the bank with
   each token; a revoked one reads "Key rejected").
2. Buy the cheapest plan with a real card. Back on `/subscribe` the plan
   switches on within seconds.
3. `/goo-studio/subscriptions`: the subscriber's card column reads "monobank
   subscription"; the transaction log has `checkout_started` and
   `payment_success`, both marked "monobank subscription". If the log shows
   `checkout_started` without that mark, the bank refused a subscription and
   the invoice road was used — ask support to switch subscriptions on.
4. Cancel in `/profile`: the log shows `canceled`, the monobank business
   cabinet shows the subscription cancelled, nothing is refunded.

The webhook URLs are passed with every subscription and invoice, so nothing
has to be configured for them in the monobank cabinet.

Instead of step 2 at a plan's full price, the
[test subscription](#test-subscription) does the same for 10 UAH and renews the
next day.

## Test subscription

goo-studio → Subscriptions → **Test subscription**, at the bottom of the page.
Super admin only (`SUPER_ADMIN_USER_ID`): for anyone else it would be a paid
plan for 10 UAH a day.

- **What it is.** The super admin's own account subscribes to a plan of their
  choice for **10 UAH a day**, to watch real charges and renewals without
  paying a month's price and waiting a month for the next one. The money is
  real; refund it in the monobank cabinet if you like.
- **Same roads as a real checkout** (`POST /api/admin/billing-test`). First a
  bank subscription with interval `1d`: the bank charges every day and the
  hourly sync records it. If the bank refuses one, an invoice for 10 UAH that
  saves the card; after it is paid the daily `billing-renew` charges the saved
  card 10 UAH. Both return through `/subscribe`, like a customer.
- **Only the period and the amount differ** (`src/lib/server/billing-terms.ts`).
  The row's `billing_interval` is `1d` and the invoice reference ends in `|1d`
  (`<userId>|<plan>|1d`). The amount follows from the interval, never from the
  row, so a daily row cannot charge a plan's monthly price, and a real checkout
  writes `1m` back. In our ledger a test day is 23 hours, so each daily run of
  `billing-renew` finds it due: the first renewal is the first run more than
  23 hours after paying, then one a day.
- **Stop** in the same block (the profile's cancel does the same,
  `POST /api/billing/cancel`): the bank subscription is cancelled at the bank;
  on the saved-card road auto-renew is switched off. On the saved-card road the
  plan stays in Clerk afterwards (known gap 3) — set it back in Users.
- **Guards.** No test while a real paid plan is renewing on the account
  (cancel it in the profile first), and no second test while one runs.
- **On the page.** The row is marked "test" and priced per day; it is left out
  of MRR. Its payments are real money and count in "Total earned".
- **Needs migration `029`** for the saved-card road; without it the start
  answers with an error naming the migration.

## Several sites

monobank issues a terminal for a specific site, so the right setup is **a
terminal and a token per site** — the subscription token too — each project
with its own keys. Technically one token can serve several sites, but only
with the bank's consent, since the terminal was issued for one of them.
Sharing has a cost besides: revoking or rotating the token for one project
stops payments in all of them, and the bank's reports mix their money.

For goo-fashion: its own terminal, its own `MONOBANK_TOKEN` (and
`MONOBANK_SUB_TOKEN` if issued), used by no other project.

## Renewal cron on Coolify

Two Scheduled Tasks, both calling the app with `CRON_SECRET`:

| Task | Endpoint | How often | What it does |
|---|---|---|---|
| `billing-renew` | `/api/billing/cron/renew` | **once a day** | charges saved cards (road 3), recovers missing card tokens, heartbeat, alerts, weekly summary; also runs the sync below once |
| `billing-sync` | `/api/billing/cron/sync` | **every hour** | reconciles bank subscriptions and pending invoices with monobank (road 1, lost webhooks); charges nothing |

Whether `billing-renew` already exists on production cannot be seen from the
code and is still unknown (check the Renewal cron card, below). On 2026-09-27
the CEO reported that subscriptions seem not to work at all right now; a
dedicated investigation is pending (`docs/CODE_REVIEW_2026-09.md`, «Что
открыто»).

### `billing-renew` — daily

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
  webhook arrives charges the same card again. The old Vercel deployment and its
  `vercel.json` cron are confirmed gone (2026-09-27), so the only way to get two
  schedulers is a second Coolify task (or an outside cron) calling this endpoint.
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

The `200` body also carries `bankSync` — the counts of the subscription sync
it ran first (`synced`, `errors`, `lapsed`), or `{error}` if that sync failed;
the card renewals run either way.

### `billing-sync` — hourly

Same form, second task:

| Field | Value |
|---|---|
| Name | `billing-sync` |
| Frequency | `17 * * * *` (every hour) |
| Command | see below |

```sh
curl -fsS --max-time 300 -H "Authorization: Bearer $CRON_SECRET" "http://127.0.0.1:${PORT:-3000}/api/billing/cron/sync"
```

It never charges a card, so running it more often, or by hand, is safe.
Without it the daily `billing-renew` still syncs once a day; with it a lost
knock is picked up within the hour and a cancelled plan ends on time.

| Status | Meaning |
|---|---|
| `200 {"ok":true, subscriptions, invoices}` | Ran. `subscriptions.synced` — live bank subscriptions asked about; `granted` — charges counted; `lapsed` — plans returned to free; `errors` — subscriptions monobank did not answer for (`ok` is then `false`); `invoices` — pending invoices checked. |
| `401` | Wrong or missing header. |
| `503 MONOBANK_TOKEN not configured` | Payments are off. |

No heartbeat is written: the card renewal's `cron_run` is the one the admin
watches.

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
| A bank subscription's charge failed, or monobank cancelled a subscription (customer or bank) | sync |
| The bank charged an amount or currency other than the frozen terms; or charged a subscription after we cancelled it | sync |
| Paid, but setting the plan in Clerk failed — set it by hand | sync |
| An old subscription could not be cancelled after an upgrade (the customer is charged twice until it is) | sync |
| A subscription exists at monobank that we failed to record and could not invalidate | checkout |
| A cancelled plan's period ended but resetting Clerk to free failed | sync |

## Admin actions that touch billing

### Deleting a user (`/goo-studio/users`)

`DELETE /api/admin/users/[id]`:
1. Refuses to delete the super admin or yourself.
2. **Stops billing first:** cancels the user's monobank subscriptions at the
   bank (and invalidates unpaid ones), then turns auto-renew off
   (`cancelAutoRenew`). If the user's row had auto-renew on, or a bank
   subscription was cancelled, logs a `canceled` billing event "auto-renew
   disabled: account deleted by admin". If this step fails — including monobank
   refusing the cancellation — the user is **not** deleted and the admin sees
   the error.
3. Deletes the Clerk account and writes `user.deleted` to the audit log (with
   the plan and whether auto-renew was turned off).

The confirm dialog (single and bulk delete) warns about this when the user has
an `active` or `past_due` subscription. The `subscriptions` row itself is kept
with its status, so it stays on the Subscriptions page (shown by user id).

### Changing a plan (`/goo-studio/users`)

Only `publicMetadata.plan` in Clerk changes. The `subscriptions` row — plan,
price, card, auto-renew — and any monobank subscription are untouched, so:
- the saved card, or the bank subscription, keeps being charged the price of
  the subscription's plan;
- the next successful renewal writes the subscription's plan back to Clerk,
  undoing the manual change.

One exception: when a cancelled bank subscription's paid period ends, the sync
resets the plan to free only if Clerk still shows the plan that was paid for. A
plan set by hand is left as it is.

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
| MRR / By plan | Sum of the row's `amount` over subscriptions with status `active` (including those with auto-renew off), without [test subscriptions](#test-subscription). |
| Active subscribers | Rows with status `active`; "N won't renew" = those with auto-renew off. |
| Past due / Canceled / Pending checkout | Row counts by status. |
| Renewal cron | Hours since the last `cron_run` (see above). |
| Active without card | `active`, auto-renew on, no card token, and not on a monobank subscription (the bank charges those; the card column reads "monobank subscription"). The renewal charge skips these; the daily cron only retries the card lookup. Should be 0. |
| Overdue | `active` rows whose `current_period_end` has passed. |
| Failed charges | Sum of `failed_charges` over `active` and `past_due` rows only. The counter is consecutive failures and resets to 0 on a successful payment; `canceled` rows are left out. Red when above 0. |
| Transaction log | The latest 200 `billing_events`, without `cron_run`. |

## Known gaps (not fixed)

Seen in the code on 2026-09-26. Fixing any of them is a separate task by CEO
decision. Gaps 1–4 are about roads 2 and 3 (invoice and saved card); on road 1
(bank subscription) gap 3 does not apply — a cancelled plan ends with its paid
period — and neither does gap 4, since checkout no longer touches the
`subscriptions` row until the bank reports a charge.

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

Road 1, seen on 2026-10-14:

5. **A refund of a subscription charge is not undone.** A charge is recorded
   once, when it is first seen; if monobank later reports it reversed, the paid
   period stays extended.
6. **No retry if Clerk fails after a charge.** The period is extended in the
   database first; if setting the plan in Clerk then fails, the repeat knock is
   a duplicate and nothing tries again. An alert asks to set the plan by hand.
7. **A plan bought by invoice while a bank subscription runs** (only if the
   bank started refusing subscriptions after accepting them) does not cancel
   that subscription.

## Files

| Path | Purpose |
|------|---------|
| `src/lib/server/monobank.ts` | API client (subscriptions, invoices, saved cards) + webhook signature verification |
| `src/lib/server/mono-subscriptions.ts` | Road 1: create, sync, cancel bank subscriptions; end lapsed plans |
| `src/lib/server/invoice-payments.ts` | Road 2: apply a paid invoice; reconcile pending ones |
| `src/lib/server/subscriptions.ts` | Supabase ledger + Clerk plan sync + `billing_events` log |
| `src/lib/server/billing-alerts.ts` | Email alerts via Resend |
| `src/lib/plans.ts` | Plans, UAH prices, display rate |
| `src/lib/server/billing-terms.ts` | What a period costs and how long it lasts: monthly at the plan's price, or the daily 10 UAH test |
| `src/app/api/admin/billing-test/route.ts` | [Test subscription](#test-subscription): state and start, super admin only |
| `src/app/api/billing/checkout/route.ts` | Create a bank subscription (or an invoice), redirect to monobank |
| `src/app/api/billing/subscription/[secret]/[event]/route.ts` | monobank's knock for a bank subscription → sync |
| `src/app/api/billing/sync/route.ts` | Sync the signed-in customer's subscription on return from monobank |
| `src/app/api/billing/cron/sync/route.ts` | Hourly reconciliation |
| `src/app/api/billing/webhook/route.ts` | Invoice webhook: verify + activate / record failures |
| `src/app/api/billing/cron/renew/route.ts` | Daily renewal sweep, card-token recovery, heartbeat, alerts |
| `src/app/api/billing/cancel/route.ts` | Cancel: the bank subscription at monobank, then auto-renew off |
| `src/app/api/billing/status/route.ts` | Current billing state for the profile |
| `src/app/api/admin/subscriptions/route.ts` | Data for the admin Subscriptions page |
| `src/app/goo-studio/subscriptions/page.tsx` | Admin: revenue, billing health, subscribers, transaction log |
| `src/app/api/admin/users/[id]/route.ts` | Admin: delete user (bank subscription cancelled and auto-renew off first), change plan |
| `supabase-migration-subscriptions.sql` | `subscriptions` table |
| `supabase-migration-billing-events.sql` | `billing_events` table |
| `supabase/migrations/028_monobank_subscriptions.sql` | `mono_subscriptions`, `mono_subscription_charges`, `subscriptions.mono_subscription_id`, `goo_record_mono_charge()` |
