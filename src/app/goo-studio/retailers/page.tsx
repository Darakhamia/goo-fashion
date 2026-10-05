"use client";

import { useCallback, useEffect, useState } from "react";
import { storeFaviconUrl } from "@/lib/stores";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { SidePanel } from "@/components/admin/SidePanel";
import { DataTable, EmptyState, type Column } from "@/components/admin/DataTable";
import { Badge } from "@/components/admin/Badge";
import { RowMenu, type MenuItem } from "@/components/admin/Menu";
import { PageHeader, PLUS } from "@/components/admin/PageHeader";
import { btn, BTN_ICON_SM } from "../_ui/recipes";
import { useFormat, useT, type Key } from "../_i18n";

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
  /** Products the catalog scan read. */
  scanned?: number;
  /** The scan stopped at scanLimit before the end of the catalog. */
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
const GENDER_OPTIONS: { value: StoreGender; label: Key }[] = [
  { value: "", label: "retailers.gender.unset" },
  { value: "men", label: "retailers.gender.men" },
  { value: "unisex", label: "retailers.gender.unisex" },
  { value: "women", label: "retailers.gender.women" },
];
const GENDER_SHORT: Record<Exclude<StoreGender, "">, Key> = {
  men: "retailers.genderShort.men",
  women: "retailers.genderShort.women",
  unisex: "retailers.genderShort.unisex",
};

// Field base without a background, so the input and the select each set one
// (two bg utilities on one element leave the winner to stylesheet order).
const FIELD =
  "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm text-[var(--foreground)]";
const INPUT = `${FIELD} bg-transparent`;
const SELECT = `${FIELD} bg-[var(--surface)]`;
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

/** The shop's icon in a 40px tile: the picture of a row's card on a phone. */
function FaviconTile({ domain }: { domain: string }) {
  return (
    <span className="w-10 h-10 flex-shrink-0 rounded-lg inline-flex items-center justify-center bg-[var(--background)]">
      <Favicon domain={domain} />
    </span>
  );
}

function OfficialBadge() {
  const t = useT();
  return <Badge tone="ok">{t("retailers.official")}</Badge>;
}

const OFFICIAL = <OfficialBadge />;

const PENCIL = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M11 2.5L13.5 5 6 12.5l-3 .5.5-3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

export default function RetailersPage() {
  const t = useT();
  const f = useFormat();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  /** Why the rules did not load: the server's own words, its HTTP status, or no answer at all. */
  const [loadError, setLoadError] = useState<{ text?: string; status?: number } | null>(null);

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
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/retailer-domains", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setLoadError({ text: json?.error, status: res.status });
        setReport(null);
      } else {
        setReport(json as Report);
      }
    } catch {
      setLoadError({});
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
      title: t("retailers.confirm.replace", { domain: existingRule.domain }),
      body: t("retailers.confirm.replaceBody", { domain: existingRule.domain, name: existingRule.name }),
      confirmLabel: t("retailers.confirm.replaceAction"),
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
        setFormError(json?.error || t("retailers.saveFailed", { status: res.status }));
        return;
      }
      toast.ok(t("retailers.saved", { domain: domainKey(draft.domain) }));
      setPanelOpen(false);
      setDraft(EMPTY_DRAFT);
      setEditingDomain(null);
      await load();
    } catch {
      setFormError(t("retailers.unreachable"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (domain: string) => {
    if (!(await confirm({
      title: t("retailers.confirm.delete", { domain }),
      body: t("retailers.confirm.deleteBody"),
      confirmLabel: t("retailers.confirm.deleteAction"),
      tone: "danger",
    }))) return;
    setBusyDomain(domain);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/retailer-domains?domain=${encodeURIComponent(domain)}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setActionError(t("retailers.err.prefixed", { domain, error: json?.error || t("retailers.deleteFailed", { status: res.status }) }));
        return;
      }
      if (editingDomain === domain) { setPanelOpen(false); setEditingDomain(null); setDraft(EMPTY_DRAFT); }
      await load();
    } catch {
      setActionError(t("retailers.err.unreachable", { domain }));
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
    const vars = { count: affected, domain: rule.domain, name: rule.name };
    if (!(await confirm({
      title: affected ? t("retailers.confirm.apply", vars) : t("retailers.confirm.applyExisting", vars),
      body: t("retailers.confirm.applyBody"),
      confirmLabel: affected ? t("retailers.confirm.applyAction", vars) : t("retailers.confirm.applyExistingAction"),
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
        setActionError(t("retailers.err.prefixed", { domain: rule.domain, error: json?.error || t("retailers.applyFailed", { status: res.status }) }));
        return;
      }
      setApplyResult(
        json.truncated
          ? t("retailers.apply.doneTruncated", { domain: rule.domain, count: json.updated, scanned: json.scanned })
          : t("retailers.apply.done", { domain: rule.domain, count: json.updated }),
      );
      if (json.failed) {
        setActionError(t("retailers.apply.partial", { domain: rule.domain, count: json.failed }));
      }
      await load();
    } catch {
      setActionError(t("retailers.err.unreachable", { domain: rule.domain }));
    } finally {
      setBusyDomain(null);
    }
  };

  const unruled = (report?.discovered ?? []).filter((d) => !d.ruledBy);
  // A failed scan says nothing about a rule's products — Apply scans for itself.
  const scanFailed = !!report?.discoverError;

  const ruleItems = (rule: RetailerRule): MenuItem[] => {
    const count = ruleProductCount(rule.domain);
    return [
      { label: t("retailers.row.edit"), onSelect: () => startEdit(rule) },
      {
        label: busyDomain === rule.domain ? t("retailers.row.working") : t("retailers.row.apply"),
        hint: count
          ? t("retailers.row.applyHint", { count, domain: rule.domain })
          : scanFailed
            ? t("retailers.row.applyHintUnknown", { domain: rule.domain })
            : t("retailers.row.applyHintNone"),
        onSelect: () => void applyToExisting(rule),
        disabled: busyDomain === rule.domain || (!count && !scanFailed),
      },
      { kind: "separator" },
      { label: t("retailers.row.delete"), onSelect: () => void remove(rule.domain), tone: "danger", disabled: busyDomain === rule.domain },
    ];
  };

  const ruleColumns: Column<RetailerRule>[] = [
    {
      key: "domain",
      header: t("retailers.domain"),
      cell: (rule) => (
        <span className="flex items-center gap-2">
          <Favicon domain={rule.domain} />
          {rule.domain}
        </span>
      ),
    },
    {
      key: "name",
      header: t("retailers.col.name"),
      grow: true,
      cell: (rule) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{rule.name}</span>
            {rule.isOfficial && OFFICIAL}
          </div>
          {rule.defaultGender && (
            <div className="text-[12px] text-[var(--foreground-muted)] truncate">
              {t("retailers.unmarked", { gender: t(GENDER_SHORT[rule.defaultGender]) })}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "count",
      header: t("retailers.col.inCatalog"),
      align: "right",
      cell: (rule) => {
        const count = ruleProductCount(rule.domain);
        return <span className="text-[var(--foreground-muted)]">{scanFailed ? "?" : count ? f.number(count) : "—"}</span>;
      },
    },
    {
      key: "note",
      header: t("retailers.note"),
      hide: "lg",
      cell: (rule) => (
        <span className="block max-w-[280px] truncate text-[var(--foreground-muted)]" title={rule.note || undefined}>
          {rule.note || "—"}
        </span>
      ),
    },
  ];

  const domainColumns: Column<DiscoveredDomain>[] = [
    {
      key: "domain",
      header: t("retailers.domain"),
      cell: (d) => (
        <span className="flex items-center gap-2">
          <Favicon domain={d.domain} />
          {d.domain}
        </span>
      ),
    },
    {
      key: "products",
      header: t("retailers.col.products"),
      align: "right",
      cell: (d) => <span className="text-[var(--foreground-muted)]">{f.number(d.productCount)}</span>,
    },
    {
      key: "names",
      header: t("retailers.col.named"),
      grow: true,
      cell: (d) => (
        <span className="block truncate text-[var(--foreground-muted)]" title={d.currentNames.join(", ") || undefined}>
          {d.currentNames.join(", ") || "—"}
        </span>
      ),
    },
    {
      key: "official",
      header: t("retailers.col.official"),
      align: "right",
      hide: "lg",
      cell: (d) => <span className="text-[var(--foreground-muted)]">{d.officialCount ? f.number(d.officialCount) : "—"}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("nav.retailers")}
        titleExtra={<HelpButton help={help} label={t("retailers.help.label")} />}
        primary={{
          key: "add",
          label: t("retailers.add"),
          icon: PLUS,
          onClick: () => startNew(),
          disabled: !!report?.tableMissing,
          title: report?.tableMissing ? (report.setupHint ?? "") : undefined,
        }}
      />
      {help.open && (
        <div className="-mt-4">
          <HelpPanel help={help}>
            <p>{t("retailers.help.text")}</p>
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
        title={editingDomain ? t("retailers.edit", { domain: editingDomain }) : t("retailers.panel.new")}
        subtitle={editingDomain ? t("retailers.panel.subtitle") : undefined}
        footer={
          <>
            <button onClick={closePanel} className={btn("ghost")}>{t("common.cancel")}</button>
            <button
              onClick={save}
              disabled={saving || !!report?.tableMissing || !draft.domain.trim() || !draft.name.trim()}
              title={report?.tableMissing ? report.setupHint ?? "" : ""}
              className={btn("primary")}
            >
              {saving ? t("common.saving") : editingDomain ? t("retailers.panel.saveChanges") : t("retailers.add")}
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="rd-domain" className="block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">
              {t("retailers.domain")}
            </label>
            <input
              id="rd-domain"
              value={draft.domain}
              onChange={(e) => setDraft((d) => ({ ...d, domain: e.target.value }))}
              placeholder={t("retailers.field.domainPlaceholder")}
              disabled={!!editingDomain}
              className={`${INPUT} disabled:opacity-50`}
            />
          </div>
          <div>
            <label htmlFor="rd-name" className="block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">
              {t("retailers.field.name")}
            </label>
            <input
              id="rd-name"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder={t("retailers.field.namePlaceholder")}
              className={INPUT}
            />
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1.5">
              <label htmlFor="rd-gender" className="block text-[12px] font-medium text-[var(--foreground-muted)]">
                {t("retailers.field.gender")}
              </label>
              <HelpButton help={genderHelp} label={t("retailers.genderHelp.label")} />
            </div>
            <select
              id="rd-gender"
              value={draft.defaultGender}
              onChange={(e) => setDraft((d) => ({ ...d, defaultGender: e.target.value as StoreGender }))}
              className={SELECT}
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{t(o.label)}</option>
              ))}
            </select>
            {genderHelp.open && (
              <div className="mt-1.5">
                <HelpPanel help={genderHelp}>
                  <p>{t("retailers.genderHelp.text")}</p>
                </HelpPanel>
              </div>
            )}
          </div>
          <div>
            <label htmlFor="rd-note" className="block text-[12px] font-medium text-[var(--foreground-muted)] mb-1.5">
              {t("retailers.note")}
            </label>
            <input
              id="rd-note"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder={t("retailers.field.notePlaceholder")}
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
            <span className="text-sm text-[var(--foreground)]">{t("retailers.field.official")}</span>
          </label>

          {existingRule && (
            <div className="rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 flex flex-col items-start gap-3">
              <p className="text-[13px] text-[var(--warn)] leading-relaxed">
                {t("retailers.existing", { domain: existingRule.domain, name: existingRule.name })}
              </p>
              <button onClick={() => startEdit(existingRule)} className={btn("secondary")}>{t("retailers.existing.edit")}</button>
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

      {loadError && (
        <p className="text-[11px] text-[var(--err)] mt-6">
          {loadError.text || (loadError.status ? t("retailers.loadFailed", { status: loadError.status }) : t("retailers.unreachable"))}
        </p>
      )}

      {/* ── Rules ── */}
      <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mt-8 mb-3">
        {report && !(report.rulesError && !report.rules.length)
          ? t("retailers.rules.count", { count: report.rules.length })
          : t("retailers.rules")}
      </p>
      <DataTable
        label={t("retailers.rules")}
        rows={report?.rules ?? []}
        rowKey={(r) => r.domain}
        columns={ruleColumns}
        loading={loading && !report}
        onRowClick={startEdit}
        card={(rule) => ({
          thumb: <FaviconTile domain={rule.domain} />,
          title: rule.domain,
          badge: rule.isOfficial ? OFFICIAL : undefined,
          meta: t("retailers.card.inCatalog", { name: rule.name, count: report?.discoverError ? "?" : ruleProductCount(rule.domain) }),
        })}
        actions={(rule) => (
          <>
            <button
              onClick={() => startEdit(rule)}
              className={`${BTN_ICON_SM} max-md:hidden`}
              aria-label={t("retailers.edit", { domain: rule.domain })}
              title={t("retailers.edit", { domain: rule.domain })}
            >
              {PENCIL}
            </button>
            <RowMenu size="sm" label={t("menu.moreFor", { name: rule.domain })} items={ruleItems(rule)} />
          </>
        )}
        empty={
          !report || report.rulesError ? (
            <p role="alert" className="px-4 py-12 text-center text-[13px] text-[var(--err)]">
              {t("retailers.rules.loadFailed")}
            </p>
          ) : (
            <EmptyState text={t("retailers.rules.empty")} />
          )
        }
      />

      {/* ── Domains the catalog actually uses ── */}
      <p className="text-[15px] leading-[22px] font-medium text-[var(--foreground)] mt-8 mb-1">
        {report && !report.discoverError ? t("retailers.unruled.count", { count: unruled.length }) : t("retailers.unruled")}
      </p>
      <p className="text-[11px] text-[var(--foreground-muted)] mb-3 leading-relaxed">
        {t("retailers.unruled.text")}
        {report && !report.discoverError && report.scanned !== undefined && (
          <>
            {" "}
            {report.scanTruncated
              ? t("retailers.unruled.truncated", { count: report.scanned })
              : t("retailers.unruled.scannedAll", { count: report.scanned })}
          </>
        )}
      </p>

      {report?.discoverError && (
        <p className="text-[11px] text-[var(--warn)] mb-3">{report.discoverError}</p>
      )}

      <DataTable
        label={t("retailers.unruled")}
        rows={report && !report.discoverError ? unruled : []}
        rowKey={(d) => d.domain}
        columns={domainColumns}
        loading={loading && !report}
        card={(d) => ({
          thumb: <FaviconTile domain={d.domain} />,
          title: d.domain,
          meta: [t("retailers.card.products", { count: d.productCount }), ...(d.currentNames.length ? [d.currentNames.join(", ")] : [])].join(" · "),
        })}
        actions={(d) => (
          <button onClick={() => startNew(d.domain, d.currentNames[0] ?? "")} className={btn("secondary", "sm")}>
            {t("retailers.add")}
          </button>
        )}
        empty={
          !report || report.discoverError ? (
            <p role="alert" className="px-4 py-12 text-center text-[13px] text-[var(--err)]">
              {t("retailers.unruled.loadFailed")}
            </p>
          ) : (
            <EmptyState text={t(report.discovered.length ? "retailers.unruled.allRuled" : "retailers.unruled.none")} />
          )
        }
      />
    </div>
  );
}
