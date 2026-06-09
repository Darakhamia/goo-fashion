import crypto from "node:crypto";

/**
 * monobank acquiring ("Plata by mono") client.
 *
 * Docs: https://monobank.ua/api-docs/acquiring
 *
 * Flow we use:
 *   1. createInvoice() with saveCardData → returns a hosted pageUrl we send the
 *      customer to. We pass walletId so monobank tokenizes their card.
 *   2. monobank POSTs to our webHookUrl on status change (signed with X-Sign).
 *   3. For renewals we charge the saved card with chargeWallet() (no UI needed).
 *
 * All amounts are in minor units (kopiykas). All money is UAH (ccy 980) because
 * monobank acquiring does not support charging foreign currencies directly.
 */

const API_BASE = (process.env.MONOBANK_API_BASE ?? "https://api.monobank.ua").replace(/\/$/, "");
const TOKEN = process.env.MONOBANK_TOKEN ?? "";

export const isMonobankConfigured = !!TOKEN;

export class MonobankError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "MonobankError";
  }
}

async function call<T>(path: string, init: RequestInit): Promise<T> {
  if (!TOKEN) {
    throw new MonobankError("MONOBANK_TOKEN is not configured.");
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Token": TOKEN,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "errText" in body
        ? String((body as { errText: unknown }).errText)
        : `monobank ${path} failed (${res.status})`;
    throw new MonobankError(msg, res.status);
  }
  return body as T;
}

// ── Invoice creation ──────────────────────────────────────────────────────────

export interface CreateInvoiceParams {
  /** Amount in kopiykas. */
  amount: number;
  /** ISO 4217 numeric currency code. Defaults to UAH (980). */
  ccy?: number;
  /** Our order reference — we encode "<userId>|<plan>" so the webhook is self-describing. */
  reference: string;
  /** Short human description shown on the payment page. */
  destination: string;
  /** Where monobank returns the customer after payment (GET). */
  redirectUrl: string;
  /** Where monobank POSTs status updates. */
  webHookUrl: string;
  /** Pass to tokenize the customer's card for later recurring charges. */
  walletId?: string;
  /** Seconds the invoice stays payable. Defaults to monobank's 24h. */
  validitySeconds?: number;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  pageUrl: string;
}

export async function createInvoice(params: CreateInvoiceParams): Promise<CreateInvoiceResult> {
  const body: Record<string, unknown> = {
    amount: params.amount,
    ccy: params.ccy ?? 980,
    merchantPaymInfo: {
      reference: params.reference,
      destination: params.destination,
    },
    redirectUrl: params.redirectUrl,
    webHookUrl: params.webHookUrl,
  };
  if (params.validitySeconds) body.validity = params.validitySeconds;
  if (params.walletId) {
    // Tokenize the card so we can charge it again for auto-renewal.
    body.saveCardData = { saveCard: true, walletId: params.walletId };
  }

  return call<CreateInvoiceResult>("/api/merchant/invoice/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// ── Invoice status ──────────────────────────────────────────────────────────

export type InvoiceStatus =
  | "created"
  | "processing"
  | "hold"
  | "success"
  | "failure"
  | "reversed"
  | "expired";

export interface InvoiceStatusResult {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  finalAmount?: number;
  reference?: string;
  failureReason?: string;
  modifiedDate?: string;
}

export async function getInvoiceStatus(invoiceId: string): Promise<InvoiceStatusResult> {
  return call<InvoiceStatusResult>(
    `/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
    { method: "GET" }
  );
}

// ── Saved cards / recurring charges ───────────────────────────────────────────

export interface WalletCard {
  cardToken: string;
  maskedPan: string;
  expDate: string;
  country?: string;
}

export async function listWalletCards(walletId: string): Promise<WalletCard[]> {
  const res = await call<{ wallet?: WalletCard[] }>(
    `/api/merchant/wallet?walletId=${encodeURIComponent(walletId)}`,
    { method: "GET" }
  );
  return res.wallet ?? [];
}

export interface ChargeWalletParams {
  cardToken: string;
  amount: number;
  ccy?: number;
  reference: string;
  destination: string;
  webHookUrl: string;
  /** "merchant" for unattended recurring charges, "client" when the user is present. */
  initiationKind?: "merchant" | "client";
}

export interface ChargeWalletResult {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  tdsUrl?: string;
  failureReason?: string;
}

/** Charge a previously tokenized card. Used for monthly auto-renewal. */
export async function chargeWallet(params: ChargeWalletParams): Promise<ChargeWalletResult> {
  return call<ChargeWalletResult>("/api/merchant/wallet/payment", {
    method: "POST",
    body: JSON.stringify({
      cardToken: params.cardToken,
      amount: params.amount,
      ccy: params.ccy ?? 980,
      initiationKind: params.initiationKind ?? "merchant",
      webHookUrl: params.webHookUrl,
      merchantPaymInfo: {
        reference: params.reference,
        destination: params.destination,
      },
    }),
  });
}

// ── Webhook signature verification ────────────────────────────────────────────

let cachedPubKeyPem: string | null = null;

async function fetchPublicKeyPem(): Promise<string> {
  const res = await call<{ key: string }>("/api/merchant/pubkey", { method: "GET" });
  // The `key` field is base64; decoding it yields the PEM-formatted public key.
  return Buffer.from(res.key, "base64").toString("utf-8");
}

/**
 * Verify a monobank webhook.
 *
 * monobank signs the raw request body with ECDSA (SHA256) using its merchant
 * key. The signature arrives base64-encoded in the `X-Sign` header. We verify
 * against the public key from /api/merchant/pubkey, refetching once if a stale
 * cached key fails (monobank rotates keys rarely).
 */
export async function verifyWebhookSignature(rawBody: string, xSign: string | null): Promise<boolean> {
  if (!xSign) return false;
  const signature = Buffer.from(xSign, "base64");

  const tryVerify = (pem: string): boolean => {
    try {
      const verifier = crypto.createVerify("SHA256");
      verifier.update(rawBody);
      verifier.end();
      return verifier.verify(pem, signature);
    } catch {
      return false;
    }
  };

  if (!cachedPubKeyPem) {
    cachedPubKeyPem = await fetchPublicKeyPem();
  }
  if (tryVerify(cachedPubKeyPem)) return true;

  // Cached key may be stale — refetch once and retry.
  cachedPubKeyPem = await fetchPublicKeyPem();
  return tryVerify(cachedPubKeyPem);
}

/** Shape of the webhook POST body monobank sends on invoice status change. */
export interface WebhookPayload {
  invoiceId: string;
  status: InvoiceStatus;
  amount: number;
  ccy: number;
  finalAmount?: number;
  reference?: string;
  failureReason?: string;
  modifiedDate?: string;
}
