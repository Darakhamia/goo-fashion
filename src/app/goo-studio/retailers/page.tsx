"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { storeFaviconUrl } from "@/lib/stores";

type StoreGender = "" | "men" | "women" | "unisex";

interface RetailerRule {
  domain: string;
  name: string;
  isOfficial: boolean;
  defaultGender?: Exclude<StoreGender, "">;
  note?: string;
  updatedAt?: string;
}

interface DiscoveredDomain {
  domain: string;
  productCount: number;
  currentNames: string[];
  officialCount: number;
  ruledBy?: string;
}

interface Report {
  rules: RetailerRule[];
  discovered: DiscoveredDomain[];
  discoverError: string | null;
  scanLimit: number;
  /** Products the catalogue scan read. */
  scanned?: number;
  /** The scan stopped at scanLimit before the end of the catalogue. */
  scanTruncated?: boolean;
  /** Migration 018 has not been run here. */
  tableMissing?: boolean;
  setupHint?: string | null;
  rulesError?: string | null;
}

const EMPTY_DRAFT = { domain: "", name: "", isOfficial: false, defaultGender: "" as StoreGender, note: "" };

/** The key a typed domain is saved under — mirrors normalizeDomain in lib/server/retailer-domains. */
function domainKey(value: string): string {
  const host = value.trim().toLowerCase().replace(/^[a-z][a-z0-9+.-]*:\/\//, "").split(/[/?#]/)[0];
  return host.replace(/^www\./, "").replace(/\.$/, "");
}

/** What each setting means, in the words of the store's own navigation. */
const GENDER_OPTIONS: { value: StoreGender; label: string }[] = [
  { value: "", label: "Not set — learn from the catalogue" },
  { value: "men", label: "Men — the site's “All” is menswear" },
  { value: "unisex", label: "Unisex — the site's “All” is for anyone" },
  { value: "women", label: "Women — the store sells womenswear only" },
];
const GENDER_SHORT: Record<Exclude<StoreGender, "">, string> = { men: "Men", women: "Women", unisex: "Unisex" };

const INPUT =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)]";
const PRIMARY =
  "bg-[var(--foreground)] text-[var(--background)] px-4 py-2 rounded-lg text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40";
const GHOST =
  "border border-[var(--border)] px-3 py-1.5 rounded-lg text-[11px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] disabled:opacity-40 transition-colors";
const TH =
  "text-left px-4 py-3 text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] font-normal";

function Favicon({ domain }: { domain: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={storeFaviconUrl(domain)}
      alt=""
      aria-hidden="true"
      width={16}
      height={16}
      className="w-4 h-4 rounded-sm shrink-0"
    />
  );
}

function OfficialBadge() {
  return (
    <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] tracking-[0.14em] uppercase bg-emerald-400/15 text-emerald-500 border border-emerald-400/30">
      Official
    </span>
  );
}

export default function RetailersPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState("");
  /** A row action (Apply, Delete) that failed — red, apart from the grey result line. */
  const [actionError, setActionError] = useState("");

  const editorRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/retailer-domains", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setLoadError(json?.error || `Failed to load (${res.status})`);
        setReport(null);
      } else {
        setReport(json as Report);
      }
    } catch {
      setLoadError("Could not reach the server.");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startNew = (domain = "", name = "") => {
    setEditingDomain(null);
    setDraft({ ...EMPTY_DRAFT, domain, name });
    setFormError("");
  };

  /** The editor sits above both tables; a row button that fills it brings it into view. */
  const revealEditor = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    editorRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    nameInputRef.current?.focus({ preventScroll: true });
  };

  const startEdit = (rule: RetailerRule) => {
    setEditingDomain(rule.domain);
    setDraft({
      domain: rule.domain,
      name: rule.name,
      isOfficial: rule.isOfficial,
      defaultGender: rule.defaultGender ?? "",
      note: rule.note ?? "",
    });
    setFormError("");
    revealEditor();
  };

  // A new rule typed for a domain that already has one would silently replace
  // it (the save is an upsert), so it is named before that happens.
  const existingRule = editingDomain
    ? undefined
    : report?.rules.find((r) => r.domain === domainKey(draft.domain));

  const save = async () => {
    if (existingRule && !confirm(
      `${existingRule.domain} already has a rule ("${existingRule.name}"). Replace its name, official flag, gender and note?`,
    )) return;
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/admin/retailer-domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) {
        setFormError(json?.error || `Save failed (${res.status})`);
        return;
      }
      setDraft(EMPTY_DRAFT);
      setEditingDomain(null);
      await load();
    } catch {
      setFormError("Could not reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (domain: string) => {
    if (!confirm(`Delete the rule for ${domain}? Products already imported keep the names they have.`)) return;
    setBusyDomain(domain);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/retailer-domains?domain=${encodeURIComponent(domain)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setActionError(`${domain}: ${json?.error || `delete failed (${res.status})`}`);
        return;
      }
      if (editingDomain === domain) { setEditingDomain(null); setDraft(EMPTY_DRAFT); }
      await load();
    } catch {
      setActionError(`${domain}: could not reach the server.`);
    } finally {
      setBusyDomain(null);
    }
  };

  /**
   * Products a rule covers: its own domain plus every subdomain the server
   * assigns to it (`ruledBy`) — the same set Apply rewrites. A product linking
   * to two of those hosts counts once per host.
   */
  const ruleProductCount = (domain: string) =>
    (report?.discovered ?? []).reduce((n, d) => (d.ruledBy === domain ? n + d.productCount : n), 0);

  const applyToExisting = async (rule: RetailerRule) => {
    const affected = ruleProductCount(rule.domain);
    const scope = affected ? `${affected} product${affected === 1 ? "" : "s"}` : "existing products";
    if (!confirm(
      `Rewrite the store name on ${scope} linking to ${rule.domain} to "${rule.name}"?\n\n` +
      `This replaces names that were corrected by hand on individual products.`,
    )) return;

    setBusyDomain(rule.domain);
    setApplyResult("");
    setActionError("");
    try {
      const res = await fetch("/api/admin/retailer-domains/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: rule.domain }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        setActionError(`${rule.domain}: ${json?.error || `apply failed (${res.status})`}`);
        return;
      }
      setApplyResult(
        `${rule.domain}: updated ${json.updated} product${json.updated === 1 ? "" : "s"}` +
        (json.truncated ? ` (scanned the first ${json.scanned})` : ""),
      );
      if (json.failed) {
        setActionError(
          `${rule.domain}: ${json.failed} product${json.failed === 1 ? "" : "s"} could not be updated — run Apply again.`,
        );
      }
      await load();
    } catch {
      setActionError(`${rule.domain}: could not reach the server.`);
    } finally {
      setBusyDomain(null);
    }
  };

  const unruled = (report?.discovered ?? []).filter((d) => !d.ruledBy);

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Retailers</h1>
      <p className="text-xs text-[var(--foreground-muted)] mt-1 leading-relaxed">
        What a shop is called, and whether it is the brand&apos;s own store, kept once per domain.
        Without a rule both are guessed from the link — which is why imports arrive named after a
        host and rarely marked official. Rules apply to every product imported afterwards.
      </p>

      {/* The table is absent, so nothing can be saved yet. Said once, at the
          top, naming the migration — rather than letting the admin fill the
          form in and meet a PostgREST schema-cache message on submit. */}
      {report?.tableMissing && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 mt-6">
          <p className="text-[13px] text-amber-500 leading-relaxed">{report.setupHint}</p>
        </div>
      )}

      {report?.rulesError && (
        <p className="text-[11px] text-red-500 mt-6">{report.rulesError}</p>
      )}

      {/* ── Editor ── */}
      <div ref={editorRef} className="rounded-xl border border-[var(--border)] bg-[var(--background)] mt-6 p-5 scroll-mt-6">
        <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)] mb-4">
          {editingDomain ? `Edit ${editingDomain}` : "New rule"}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="rd-domain" className="block text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-1.5">
              Domain
            </label>
            <input
              id="rd-domain"
              value={draft.domain}
              onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value }))}
              placeholder="farfetch.com"
              disabled={!!editingDomain}
              className={`${INPUT} disabled:opacity-50`}
            />
          </div>
          <div>
            <label htmlFor="rd-name" className="block text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-1.5">
              Store name
            </label>
            <input
              id="rd-name"
              ref={nameInputRef}
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Farfetch"
              className={INPUT}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="rd-gender" className="block text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-1.5">
              Pieces the page doesn&apos;t mark are for
            </label>
            <select
              id="rd-gender"
              value={draft.defaultGender}
              onChange={(e) => setDraft((d) => ({ ...d, defaultGender: e.target.value as StoreGender }))}
              className={`${INPUT} bg-[var(--background)]`}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--foreground-muted)] mt-1.5 leading-relaxed">
              Used only when a product&apos;s name, link and breadcrumbs say nothing about gender —
              typically a store with &ldquo;All&rdquo; and &ldquo;Women&rdquo; and no &ldquo;Men&rdquo;.
              Applies to new imports; products that already have a gender keep it.
            </p>
          </div>
          <div className="md:col-span-2">
            <label htmlFor="rd-note" className="block text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-muted)] mb-1.5">
              Note
            </label>
            <input
              id="rd-note"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder="Anything worth remembering about this shop"
              className={INPUT}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 mt-4 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={draft.isOfficial}
            onChange={(e) => setDraft((d) => ({ ...d, isOfficial: e.target.checked }))}
            className="w-3.5 h-3.5 accent-[var(--foreground)] cursor-pointer"
          />
          <span className="text-sm text-[var(--foreground)]">This domain is the brand&apos;s official store</span>
        </label>

        {existingRule && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-3 mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-amber-500 leading-relaxed">
              {existingRule.domain} already has a rule (&ldquo;{existingRule.name}&rdquo;). Adding it again replaces
              that rule&apos;s name, official flag, gender and note.
            </p>
            <button onClick={() => startEdit(existingRule)} className={GHOST}>Edit that rule</button>
          </div>
        )}

        {formError && <p className="text-[11px] text-red-500 mt-3">{formError}</p>}

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={save}
            disabled={saving || !!report?.tableMissing || !draft.domain.trim() || !draft.name.trim()}
            title={report?.tableMissing ? report.setupHint ?? "" : ""}
            className={PRIMARY}
          >
            {saving ? "Saving…" : editingDomain ? "Save changes" : "Add rule"}
          </button>
          {(editingDomain || draft.domain || draft.name) && (
            <button onClick={() => startNew()} className={GHOST}>Cancel</button>
          )}
        </div>
      </div>

      {applyResult && (
        <p className="text-[11px] text-[var(--foreground-muted)] mt-4">{applyResult}</p>
      )}
      {actionError && (
        <p role="alert" className="text-[11px] text-red-500 mt-4">{actionError}</p>
      )}

      {loadError && <p className="text-[11px] text-red-500 mt-6">{loadError}</p>}

      {/* ── Rules ── */}
      <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)] mt-8 mb-3">
        Rules {report && !(report.rulesError && !report.rules.length) ? `(${report.rules.length})` : ""}
      </p>
      <div className="rounded-xl border border-[var(--border)] overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: "var(--surface)" }}>
            <tr>
              <th className={TH}>Domain</th>
              <th className={TH}>Name</th>
              <th className={TH}>In catalogue</th>
              <th className={TH}>Note</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {loading && !report ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</td></tr>
            ) : !report || (report.rulesError && !report.rules.length) ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                Could not load the rules.
              </td></tr>
            ) : !report.rules.length ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                No rules yet. Add one above, or pick a domain from the list below.
              </td></tr>
            ) : (
              report.rules.map((rule) => {
                const count = ruleProductCount(rule.domain);
                // A failed scan says nothing about this rule — Apply scans for itself.
                const scanFailed = !!report.discoverError;
                return (
                  <tr key={rule.domain} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                        <Favicon domain={rule.domain} />
                        {rule.domain}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                        {rule.name}
                        {rule.isOfficial && <OfficialBadge />}
                      </span>
                      {rule.defaultGender && (
                        <span className="block text-[11px] text-[var(--foreground-muted)] mt-0.5">
                          Unmarked pieces: {GENDER_SHORT[rule.defaultGender]}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">
                      {scanFailed ? "?" : count ? `${count}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] text-[var(--foreground-muted)]">{rule.note || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => startEdit(rule)} className={GHOST}>Edit</button>
                        <button
                          onClick={() => applyToExisting(rule)}
                          disabled={busyDomain === rule.domain || (!count && !scanFailed)}
                          title={count
                            ? `Rewrite this name on the ${count} products already linking to ${rule.domain} or its subdomains`
                            : scanFailed
                              ? `Rewrite this name on the products already linking to ${rule.domain} or its subdomains`
                              : "No products in the catalogue link to this domain"}
                          className={GHOST}
                        >
                          {busyDomain === rule.domain ? "Working…" : "Apply to existing"}
                        </button>
                        <button
                          onClick={() => remove(rule.domain)}
                          disabled={busyDomain === rule.domain}
                          className={`${GHOST} hover:text-red-500 hover:border-red-500`}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Domains the catalogue actually uses ── */}
      <p className="text-xs tracking-[0.12em] uppercase font-medium text-[var(--foreground)] mt-8 mb-1">
        Domains without a rule {report && !report.discoverError ? `(${unruled.length})` : ""}
      </p>
      <p className="text-[11px] text-[var(--foreground-muted)] mb-3 leading-relaxed">
        Taken from the products themselves, with the names those links currently show — the wrong
        name is usually how you recognise the row.
        {report && !report.discoverError && report.scanned !== undefined && (
          report.scanTruncated
            ? ` Scanned the first ${report.scanned} products only — domains used further on are missing.`
            : ` Scanned all ${report.scanned} products.`
        )}
      </p>

      {report?.discoverError && (
        <p className="text-[11px] text-amber-500 mb-3">{report.discoverError}</p>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: "var(--surface)" }}>
            <tr>
              <th className={TH}>Domain</th>
              <th className={TH}>Products</th>
              <th className={TH}>Currently named</th>
              <th className={TH}>Marked official</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {loading && !report ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</td></tr>
            ) : !report || report.discoverError ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                Could not load the catalogue&apos;s domains.
              </td></tr>
            ) : !unruled.length ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">
                {report?.discovered.length ? "Every domain in the catalogue has a rule." : "No product links found."}
              </td></tr>
            ) : (
              unruled.map((d) => (
                <tr key={d.domain} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                      <Favicon domain={d.domain} />
                      {d.domain}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">{d.productCount}</td>
                  <td className="px-4 py-3 text-[13px] text-[var(--foreground-muted)]">
                    {d.currentNames.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--foreground-muted)]">
                    {d.officialCount || "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { startNew(d.domain, d.currentNames[0] ?? ""); revealEditor(); }}
                      className={GHOST}
                    >
                      Add rule
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
