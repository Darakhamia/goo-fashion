"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/Toast";
import { PageHeader } from "@/components/admin/PageHeader";
import { DataTable, EmptyState, type Column } from "@/components/admin/DataTable";
import { btn, BTN_ICON_SM } from "@/app/goo-studio/_ui/recipes";
import { useFormat, useT } from "@/app/goo-studio/_i18n";

/*
 * The waitlist: an archive. The public signup form was removed in September
 * 2026, so no new addresses arrive; these are the emails collected before.
 * The page has no menu entry and stays at /goo-studio/waitlist.
 */

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}

/** Why the list did not load: the server's own message, an HTTP status, or no answer at all. */
type LoadError = { server: string } | { status: number } | { network: true };

const COPY_ICON = (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="8" height="8" rx="1" />
    <path d="M2 10V2h8" />
  </svg>
);

const REFRESH_ICON = (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2v4H8M2 12v-4h4" />
    <path d="M12 6A5 5 0 1 0 8 12" />
  </svg>
);

export default function WaitlistPage() {
  const t = useT();
  const f = useFormat();
  const confirm = useConfirm();
  const toast = useToast();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/waitlist");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setEntries(data);
      } else {
        setEntries([]);
        setLoadError(data?.error ? { server: String(data.error) } : { status: res.status });
      }
    } catch {
      setEntries([]);
      setLoadError({ network: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadErrorText = !loadError
    ? ""
    : "server" in loadError
      ? loadError.server
      : "status" in loadError
        ? t("waitlist.httpError", { status: loadError.status })
        : t("common.networkError");

  const remove = async (email: string) => {
    if (!(await confirm({
      title: t("waitlist.confirm.title", { email }),
      body: t("waitlist.confirm.body"),
      confirmLabel: t("waitlist.confirm.action"),
      tone: "danger",
    }))) return;
    setDeleting(email);
    try {
      const res = await fetch("/api/admin/waitlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setEntries((prev) => prev.filter((e) => e.email !== email));
      } else {
        toast.err(t("waitlist.removeFailed", { email, error: data?.error ?? `HTTP ${res.status}` }));
      }
    } catch {
      toast.err(t("waitlist.removeFailed", { email, error: t("common.networkError") }));
    } finally {
      setDeleting(null);
    }
  };

  const copyAll = () => {
    const text = entries.map((e) => e.email).join("\n");
    navigator.clipboard.writeText(text).then(
      () => toast.ok(t("waitlist.copied", { count: entries.length })),
      () => toast.err(t("waitlist.copyFailed")),
    );
  };

  const columns: Column<WaitlistEntry>[] = [
    {
      key: "email",
      header: t("waitlist.col.email"),
      grow: true,
      cell: (e) => (
        <span className="block truncate" title={e.email}>
          {e.email}
        </span>
      ),
    },
    {
      key: "signedUp",
      header: t("waitlist.col.signedUp"),
      cell: (e) => <span className="text-[var(--foreground-muted)] tabular-nums">{f.date(e.created_at)}</span>,
    },
  ];

  return (
    <div>
      <PageHeader
        title={t("waitlist.title")}
        subtitle={
          loading
            ? t("common.loading")
            : loadError
              ? t("waitlist.loadFailedShort")
              : `${t("waitlist.count", { count: entries.length })} · ${t("waitlist.archive")}`
        }
        actions={[
          {
            key: "copy",
            label: t("waitlist.copyAll"),
            icon: COPY_ICON,
            onClick: copyAll,
            disabled: entries.length === 0,
            title: t("waitlist.copyHint"),
          },
          { key: "refresh", label: t("waitlist.refresh"), icon: REFRESH_ICON, onClick: () => void load(), disabled: loading },
        ]}
      />

      <DataTable
        label={t("waitlist.title")}
        rows={entries}
        rowKey={(e) => e.id ?? e.email}
        columns={columns}
        loading={loading}
        card={(e) => ({ title: e.email, meta: f.date(e.created_at) })}
        actions={(e) => (
          <button
            type="button"
            onClick={() => remove(e.email)}
            disabled={deleting === e.email}
            className={BTN_ICON_SM}
            title={t("waitlist.remove", { email: e.email })}
            aria-label={t("waitlist.remove", { email: e.email })}
          >
            {deleting === e.email ? (
              <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
                <circle cx="6" cy="6" r="4.5" strokeOpacity="0.2" />
                <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" aria-hidden="true">
                <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" />
              </svg>
            )}
          </button>
        )}
        empty={
          loadError ? (
            <div role="alert">
              <EmptyState
                text={t("waitlist.loadFailed", { error: loadErrorText })}
                action={
                  <button type="button" onClick={() => void load()} className={btn("secondary")}>
                    {t("common.retry")}
                  </button>
                }
              />
            </div>
          ) : (
            <EmptyState text={t("waitlist.empty")} />
          )
        }
      />
    </div>
  );
}
