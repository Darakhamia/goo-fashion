# Billing — monobank (Plata by mono)

Real subscription billing for the paid plans (Basic / Pro / Premium), with
**monthly auto-renewal**. Replaces the old demo "upgrade instantly" flow.

## How it works

1. **Checkout** — `/subscribe` → `POST /api/billing/checkout` creates a monobank
   invoice (tokenizing the card via `walletId = Clerk user id`) and redirects the
   customer to monobank's hosted payment page.
2. **Confirmation** — monobank POSTs to `POST /api/billing/webhook` on every
   status change. We verify the ECDSA `X-Sign` signature against
   `/api/merchant/pubkey`, and on `success` we unlock the plan in Clerk
   (`publicMetadata.plan`) and store the saved-card token in Supabase.
3. **Auto-renewal** — a daily Vercel Cron hits `GET /api/billing/cron/renew`,
   which charges the saved card (`POST /api/merchant/wallet/payment`,
   `initiationKind: "merchant"`) for any subscription whose period has ended.
   After 3 consecutive failures the user is downgraded to free.
4. **Cancel** — `/profile` → `POST /api/billing/cancel` turns off `auto_renew`.
   The user keeps access until the current period ends.

> 💱 **Currency:** monobank acquiring charges in **UAH only** — it cannot bill
> USD/EUR directly. Plan prices live in `src/lib/plans.ts` (`PLAN_PRICE_UAH`),
> overridable via `MONOBANK_PRICE_*` env vars.

## Setup checklist

1. **Run the DB migration** — `supabase-migration-subscriptions.sql` in the
   Supabase SQL editor (creates the `subscriptions` table).
2. **Set env vars** (see `.env.example`):
   - `MONOBANK_TOKEN` — merchant API token from https://web.monobank.ua
   - `NEXT_PUBLIC_SITE_URL` — your public origin (used for redirect + webhook URLs)
   - `CRON_SECRET` — random secret; Vercel sends it as `Authorization: Bearer` to the cron
   - `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` and Clerk keys (already required)
3. **Deploy to Vercel** — `vercel.json` already declares the daily renewal cron
   (`/api/billing/cron/renew` at 09:00 UTC). Set `CRON_SECRET` in the Vercel
   project so scheduled calls authenticate.
4. The webhook URL is registered automatically per-invoice (`webHookUrl`), so no
   manual webhook config is needed in the monobank dashboard.

## Files

| Path | Purpose |
|------|---------|
| `src/lib/server/monobank.ts` | API client + webhook signature verification |
| `src/lib/server/subscriptions.ts` | Supabase ledger + Clerk plan sync |
| `src/app/api/billing/checkout/route.ts` | Create invoice, redirect to monobank |
| `src/app/api/billing/webhook/route.ts` | Verify + activate / record failures |
| `src/app/api/billing/cron/renew/route.ts` | Monthly auto-renewal sweep |
| `src/app/api/billing/cancel/route.ts` | Turn off auto-renewal |
| `src/app/api/billing/status/route.ts` | Current billing state for the profile |
| `supabase-migration-subscriptions.sql` | `subscriptions` table |
