"use client";

import { BTN_ICON_SM, btn, FIELD_LABEL, INPUT, SELECT } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";
import { CURRENCIES } from "@/lib/context/currency-context";
import { bareHost, pastedUrl } from "@/lib/url";
import { PLUS } from "@/components/admin/PageHeader";
import { AVAILABILITY_LABEL, AVAILABILITY_OPTIONS, EXAMPLE, emptyRetailer, type Availability, type RetailerForm } from "./form";

/*
 * Where to buy (GS6-1): one row per store — the store, its price and currency
 * in one cell, availability, the link — and under it the rarer fields
 * (official store, rating, reviews). Where the block is narrower than the
 * table needs (a phone, or a laptop beside the preview column) each store is
 * a card with labelled fields. The store name picks from the library of known stores
 * (brands with logos and the Retailers page's names), so a listing shows a
 * real logo; a pasted link with no name takes the name of its domain's rule.
 */

/** The table's columns, once the block is wide enough for them (a container query). */
const COLS = "@3xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_28px]";

export function StoreTable({
  retailers,
  onChange,
  storeLibrary,
  storeRules,
  disabled = false,
}: {
  retailers: RetailerForm[];
  onChange: (r: RetailerForm[]) => void;
  storeLibrary: { name: string; logoUrl: string | null }[];
  storeRules: { domain: string; name: string }[];
  disabled?: boolean;
}) {
  const t = useT();
  const set = (i: number, patch: Partial<RetailerForm>) => onChange(retailers.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const logoFor = (name: string) =>
    storeLibrary.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase())?.logoUrl ?? null;

  // The link as the storefront's "Buy" button needs it: the address out of
  // share text, a scheme, no ad tracking (`pastedUrl`); an empty store name
  // from the domain's rule, as an import would name it.
  const tidyUrl = (i: number) => {
    const r = retailers[i];
    const url = pastedUrl(r.url);
    if (!url) return;
    const host = bareHost(url);
    const rule = r.name.trim() ? undefined : storeRules.find((x) => host === x.domain || host.endsWith(`.${x.domain}`));
    if (url !== r.url || rule) set(i, { url, ...(rule ? { name: rule.name } : {}) });
  };

  const currencies = (code: string) =>
    // A store may price in a currency the switcher does not offer (złoty, say):
    // it stays selectable rather than being silently replaced.
    CURRENCIES.some((c) => c.code === code) ? CURRENCIES.map((c) => c.code as string) : [code, ...CURRENCIES.map((c) => c.code as string)];

  const cellLabel = `${FIELD_LABEL} @3xl:sr-only`;

  const removeButton = (r: RetailerForm, i: number) => (
    <button
      type="button"
      onClick={() => onChange(retailers.filter((_, idx) => idx !== i))}
      aria-label={t("products.store.removeNamed", { store: r.name || t("products.store.thisStore") })}
      title={t("products.store.remove")}
      className={BTN_ICON_SM}
    >
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
        <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </button>
  );

  return (
    <div className="@container flex flex-col gap-3">
      {storeLibrary.length > 0 && (
        <datalist id="product-store-library">
          {storeLibrary.map((s) => (
            <option key={s.name} value={s.name} />
          ))}
        </datalist>
      )}

      {retailers.length > 0 && (
        <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
          <div className={`hidden @3xl:grid ${COLS} gap-3 px-3 py-2 text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)]`}>
            <span>{t("products.store.name")}</span>
            <span>{t("products.col.price")}</span>
            <span>{t("products.store.availability")}</span>
            <span>{t("products.store.url")}</span>
            <span className="sr-only">{t("products.store.remove")}</span>
          </div>
          {retailers.map((r, i) => {
            const logo = logoFor(r.name);
            const id = `store-${i}`;
            return (
              <div key={i} className="px-3 py-3 flex flex-col gap-2.5">
                <div className={`grid grid-cols-2 ${COLS} gap-x-3 gap-y-2 @3xl:items-center`}>
                  <div className="col-span-2 @3xl:col-span-1 min-w-0">
                    <label htmlFor={`${id}-name`} className={cellLabel}>{t("products.store.name")}</label>
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 shrink-0 rounded-md border border-[var(--border)] bg-[var(--background)] overflow-hidden flex items-center justify-center">
                        {logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logo} alt="" className="w-full h-full object-contain p-0.5" />
                        ) : (
                          <span className="text-[11px] font-semibold text-[var(--foreground-subtle)]">{r.name.trim() ? r.name.slice(0, 2).toUpperCase() : "—"}</span>
                        )}
                      </span>
                      <input
                        id={`${id}-name`}
                        type="text"
                        list="product-store-library"
                        value={r.name}
                        disabled={disabled}
                        onChange={(e) => set(i, { name: e.target.value })}
                        placeholder={t("products.store.namePlaceholder")}
                        className={`${INPUT} flex-1 min-w-0`}
                      />
                      {/* Beside the name in a card; in the table it has a column. */}
                      {!disabled && <span className="@3xl:hidden">{removeButton(r, i)}</span>}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`${id}-price`} className={cellLabel}>{t("products.col.price")}</label>
                    <div className="flex gap-1.5 min-w-0">
                      <input
                        id={`${id}-price`}
                        type="number"
                        value={r.price}
                        disabled={disabled}
                        onChange={(e) => set(i, { price: e.target.value })}
                        placeholder="99"
                        min="0"
                        aria-label={t("products.store.priceAt", { store: r.name || t("products.store.thisStore") })}
                        className={`${INPUT} flex-1 min-w-0 tabular-nums`}
                      />
                      <select
                        value={r.currency}
                        disabled={disabled}
                        onChange={(e) => set(i, { currency: e.target.value })}
                        aria-label={t("products.store.currency")}
                        className={`${SELECT} w-[76px] shrink-0`}
                      >
                        {currencies(r.currency).map((code) => (
                          <option key={code} value={code}>{code}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <label htmlFor={`${id}-stock`} className={cellLabel}>{t("products.store.availability")}</label>
                    <select
                      id={`${id}-stock`}
                      value={r.availability}
                      disabled={disabled}
                      onChange={(e) => set(i, { availability: e.target.value as Availability })}
                      className={`${SELECT} w-full`}
                    >
                      {AVAILABILITY_OPTIONS.map((a) => (
                        <option key={a} value={a}>{t(AVAILABILITY_LABEL[a])}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 @3xl:col-span-1 min-w-0">
                    <label htmlFor={`${id}-url`} className={cellLabel}>{t("products.store.url")}</label>
                    <input
                      id={`${id}-url`}
                      type="url"
                      value={r.url}
                      disabled={disabled}
                      onChange={(e) => set(i, { url: e.target.value })}
                      onBlur={() => tidyUrl(i)}
                      placeholder={EXAMPLE.storeUrl}
                      className={`${INPUT} w-full`}
                    />
                  </div>
                  <div className="hidden @3xl:flex justify-end">{!disabled && removeButton(r, i)}</div>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--foreground-muted)]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={r.isOfficial}
                      disabled={disabled}
                      onChange={(e) => set(i, { isOfficial: e.target.checked })}
                      className="w-3.5 h-3.5 accent-[var(--foreground)]"
                    />
                    {t("products.store.official")}
                  </label>
                  <label className="flex items-center gap-2">
                    {t("products.store.rating")}
                    <input type="number" value={r.rating} disabled={disabled} onChange={(e) => set(i, { rating: e.target.value })} placeholder="4.5" min="1" max="5" step="0.1" className={`${INPUT} w-20`} />
                  </label>
                  <label className="flex items-center gap-2">
                    {t("products.store.reviews")}
                    <input type="number" value={r.reviewCount} disabled={disabled} onChange={(e) => set(i, { reviewCount: e.target.value })} placeholder="1234" min="0" className={`${INPUT} w-24`} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!disabled && (
        <button type="button" onClick={() => onChange([...retailers, emptyRetailer()])} className={`${btn("secondary")} self-start`}>
          {PLUS}
          {t("products.store.add")}
        </button>
      )}
    </div>
  );
}
