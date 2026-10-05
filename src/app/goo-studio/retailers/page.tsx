"use client";

import { useCallback, useEffect, useState } from "react";
import { storeFaviconUrl } from "@/lib/stores";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { SidePanel } from "@/components/admin/SidePanel";
import { btn } from "../_ui/recipes";

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

// Field base without a background, so the input and the select each set one
// (two bg utilities on one element leave the winner to stylesheet order).
const FIELD =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm text-[var(--foreground)]";
const INPUT = `${FIELD} bg-transparent`;
const SELECT = `${FIELD} bg-[var(--surface)]`;
const TH =
  "text-left px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] font-normal";

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
    <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--ok-bg)] text-[var(--ok)] border border-[var(--ok-line)]">
      Official
    </span>
  );
}

export default function RetailersPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [draft, setDraft] = useState(EMPTY_DRAFT);
  /** The rule form is open in the side panel (GS4-5). */
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [busyDomain, setBusyDomain] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState("");
  /** A row action (Apply, Delete) that failed — red, apart from the grey result line. */
  const [actionError, setActionError] = useState("");

  const confirm = useConfirm();
  const toast = useToast();
  const help = useHelp("retailers");
  const genderHelp = useHelp("retailers-gender");

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

  /** A new rule in the side panel; from a row of the second table, with its domain and current name filled in. */
  const startNew = (domain = "", name = "") => {
    setEditingDomain(null);
    setDraft({ ...EMPTY_DRAFT, domain, name });
    setFormError("");
    setPanelOpen(true);
  };

  const closePanel = () => setPanelOpen(false);

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
    setPanelOpen(true);
  };

  // A new rule typed for a domain that already has one would silently replace
  // it (the save is an upsert), so it is named before that happens.
  const existingRule = editingDomain
    ? undefined
    : report?.rules.find((r) => r.domain === domainKey(draft.domain));

  const save = async () => {
    if (existingRule && !(await confirm({
      title: `Replace the rule for ${existingRule.domain}?`,
      body: `${existingRule.domain} already has a rule ("${existingRule.name}"). Saving replaces its name, official flag, gender and note.`,
      confirmLabel: "Replace rule",
      tone: "danger",
    }))) return;
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
      toast.ok(`Rule for ${domainKey(draft.domain)} saved.`);
      setPanelOpen(false);
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
    if (!(await confirm({
      title: `Delete the rule for ${domain}?`,
      body: "Products already imported keep the names they have.",
      confirmLabel: "Delete rule",
      tone: "danger",
    }))) return;
    setBusyDomain(domain);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/retailer-domains?domain=${encodeURIComponent(domain)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setActionError(`${domain}: ${json?.error || `delete failed (${res.status})`}`);
        return;
      }
      if (editingDomain === domain) { setPanelOpen(false); setEditingDomain(null); setDraft(EMPTY_DRAFT); }
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
    if (!(await confirm({
      title: `Rewrite the store name on ${scope} linking to ${rule.domain} to "${rule.name}"?`,
      body: "This replaces names that were corrected by hand on individual products.",
      confirmLabel: `Apply to ${scope}`,
      tone: "danger",
    }))) return;

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
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Retailers</h1>
          <HelpButton help={help} label="How retailer rules work" />
        </div>
        <button
          onClick={() => startNew()}
          disabled={!!report?.tableMissing}
          title={report?.tableMissing ? report.setupHint ?? "" : undefined}
          className={btn("primary")}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M6 1V11M1 6H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          Add rule
        </button>
      </div>
      {help.open && (
        <div className="mt-2">
          <HelpPanel help={help}>
            <p>
              What a shop is called, and whether it is the brand&apos;s own store, kept once per domain.
              Without a rule both are guessed from the link — which is why imports arrive named after a
              host and rarely marked official. Rules apply to every product imported afterwards.
            </p>
          </HelpPanel>
        </div>
      )}

      {/* The table is absent, so nothing can be saved yet. Said once, at the
          top, naming the migration — rather than letting the admin fill the
          form in and meet a PostgREST schema-cache message on submit. */}
      {report?.tableMissing && (
        <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 mt-6">
          <p className="text-[13px] text-[var(--warn)] leading-relaxed">{report.setupHint}</p>
        </div>
      )}

      {report?.rulesError && (
        <p className="text-[11px] text-[var(--err)] mt-6">{report.rulesError}</p>
      )}

      {/* ── The rule form, in the side panel (GS4-5) ── */}
      <SidePanel
        open={panelOpen}
        onClose={closePanel}
        title={editingDomain ? `Edit ${editingDomain}` : "New rule"}
        subtitle={editingDomain ? "Domain rule" : undefined}
        footer={
          <>
            <button onClick={closePanel} className={btn("ghost")}>Cancel</button>
            <button
              onClick={save}
              disabled={saving || !!report?.tableMissing || !draft.domain.trim() || !draft.name.trim()}
              title={report?.tableMissing ? report.setupHint ?? "" : ""}
              className={btn("primary")}
            >
              {saving ? "Saving…" : editingDomain ? "Save changes" : "Add rule"}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="rd-domain" className="block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">
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
            <label htmlFor="rd-name" className="block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">
              Store name
            </label>
            <input
              id="rd-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Farfetch"
              className={INPUT}
            />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <label htmlFor="rd-gender" className="block text-[12px] font-medium text-[var(--foreground-muted)]">
                Pieces the page doesn&apos;t mark are for
              </label>
              <HelpButton help={genderHelp} label="How the gender default works" />
            </div>
            <select
              id="rd-gender"
              value={draft.defaultGender}
              onChange={(e) => setDraft((d) => ({ ...d, defaultGender: e.target.value as StoreGender }))}
              className={SELECT}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {genderHelp.open && (
              <div className="mt-1.5">
                <HelpPanel help={genderHelp}>
                  <p>
                    Used only when a product&apos;s name, link and breadcrumbs say nothing about gender —
                    typically a store with &ldquo;All&rdquo; and &ldquo;Women&rdquo; and no &ldquo;Men&rdquo;.
                    Applies to new imports; products that already have a gender keep it.
                  </p>
                </HelpPanel>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="rd-note" className="block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">
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

          <label className="flex items-center gap-2 cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={draft.isOfficial}
              onChange={(e) => setDraft((d) => ({ ...d, isOfficial: e.target.checked }))}
              className="w-4 h-4 accent-[var(--foreground)] cursor-pointer"
            />
            <span className="text-sm text-[var(--foreground)]">This domain is the brand&apos;s official store</span>
          </label>

          {existingRule && (
            <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 flex flex-col items-start gap-3">
              <p className="text-[13px] text-[var(--warn)] leading-relaxed">
                {existingRule.domain} already has a rule (&ldquo;{existingRule.name}&rdquo;). Adding it again replaces
                that rule&apos;s name, official flag, gender and note.
              </p>
              <button onClick={() => startEdit(existingRule)} className={btn("secondary")}>Edit that rule</button>
            </div>
          )}

          {formError && <p role="alert" className="text-[12px] text-[var(--err)]">{formError}</p>}
        </div>
      </SidePanel>

      {applyResult && (
        <p className="text-[11px] text-[var(--foreground-muted)] mt-4">{applyResult}</p>
      )}
      {actionError && (
        <p role="alert" className="text-[11px] text-[var(--err)] mt-4">{actionError}</p>
      )}

      {loadError && <p className="text-[11px] text-[var(--err)] mt-6">{loadError}</p>}

      {/* ── Rules ── */}
      <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mt-8 mb-3">
        Rules {report && !(report.rulesError && !report.rules.length) ? `(${report.rules.length})` : ""}
      </p>
      <div className="rounded-xl border border-[var(--border)] overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: "var(--background)" }}>
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
                No rules yet. Add one, or pick a domain from the list below.
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
                        <button onClick={() => startEdit(rule)} className={btn("secondary", "sm")}>Edit</button>
                        <button
                          onClick={() => applyToExisting(rule)}
                          disabled={busyDomain === rule.domain || (!count && !scanFailed)}
                          title={count
                            ? `Rewrite this name on the ${count} products already linking to ${rule.domain} or its subdomains`
                            : scanFailed
                              ? `Rewrite this name on the products already linking to ${rule.domain} or its subdomains`
                              : "No products in the catalogue link to this domain"}
                          className={btn("secondary", "sm")}
                        >
                          {busyDomain === rule.domain ? "Working…" : "Apply to existing"}
                        </button>
                        <button
                          onClick={() => remove(rule.domain)}
                          disabled={busyDomain === rule.domain}
                          className={btn("danger", "sm")}
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
      <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mt-8 mb-1">
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
        <p className="text-[11px] text-[var(--warn)] mb-3">{report.discoverError}</p>
      )}

      <div className="rounded-xl border border-[var(--border)] overflow-hidden overflow-x-auto">
        <table className="w-full">
          <thead style={{ background: "var(--background)" }}>
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
                      onClick={() => startNew(d.domain, d.currentNames[0] ?? "")}
                      className={btn("secondary", "sm")}
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
