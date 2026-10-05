"use client";

import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { btn, BTN_ICON } from "@/app/goo-studio/_ui/recipes";
import { useFormat } from "@/app/goo-studio/_i18n";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}

// Admin status recipe (DESIGN_SYSTEM.md §9)
const statusWarn = "bg-[var(--warn-bg)] text-[var(--warn)] border border-[var(--warn-line)]";
const statusErr  = "bg-[var(--err-bg)] text-[var(--err)] border border-[var(--err-line)]";

const thCls = "text-left px-4 py-3 text-[11px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] font-normal";

export default function WaitlistPage() {
  const confirm = useConfirm();
  const f = useFormat();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/admin/waitlist");
      const data = await res.json().catch(() => null);
      if (res.ok && Array.isArray(data)) {
        setEntries(data);
      } else {
        setEntries([]);
        setLoadError(data?.error ?? `Request failed (HTTP ${res.status}).`);
      }
    } catch {
      setEntries([]);
      setLoadError("Network error.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (email: string) => {
    if (!(await confirm({
      title: `Remove ${email} from the waitlist?`,
      body: "This cannot be undone.",
      confirmLabel: "Remove email",
      tone: "danger",
    }))) return;
    setDeleting(email);
    setActionError("");
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
        setActionError(`Couldn't remove ${email}: ${data?.error ?? `HTTP ${res.status}`}`);
      }
    } catch {
      setActionError(`Couldn't remove ${email}: network error.`);
    } finally {
      setDeleting(null);
    }
  };

  const copyAll = () => {
    const text = entries.map((e) => e.email).join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setActionError("Couldn't copy to the clipboard — the browser refused access."),
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Waitlist</h1>
          <p className="text-xs text-[var(--foreground-muted)] mt-1">
            {loading ? "Loading…" : loadError ? "Couldn't load the list" : `${entries.length} email${entries.length !== 1 ? "s" : ""} collected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAll}
            disabled={entries.length === 0}
            className={btn("secondary")}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="8" height="8" rx="1" />
              <path d="M2 10V2h8" />
            </svg>
            {copied ? "Copied!" : "Copy all"}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className={btn("secondary")}
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4H8M2 12v-4h4" />
              <path d="M12 6A5 5 0 1 0 8 12" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Archive notice */}
      <div className={`mb-4 rounded-xl px-4 py-3 text-xs ${statusWarn}`}>
        <span className="font-medium">Archive.</span> The public signup form was removed in September 2026 — no new
        addresses arrive. These are the emails collected before that.
      </div>

      {actionError && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-xs ${statusErr}`}>{actionError}</div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[var(--border)] overflow-x-auto" style={{ background: "var(--surface)" }}>
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">Loading…</div>
        ) : loadError ? (
          <div className="px-4 py-12 text-center">
            <p className={`inline-block rounded-lg px-3 py-2 text-xs ${statusErr}`}>
              Couldn&apos;t load the waitlist: {loadError}
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-[var(--foreground-subtle)]">The waitlist is empty.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)]" style={{ background: "var(--background)" }}>
                <th className={thCls}>Email</th>
                <th className={`${thCls} w-40`}>Signed up</th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id ?? entry.email}
                  className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--background)] transition-colors"
                >
                  <td className="px-4 py-3 text-[13px] text-[var(--foreground)] font-mono">{entry.email}</td>
                  <td className="px-4 py-3 text-[11px] text-[var(--foreground-muted)] whitespace-nowrap">
                    {f.date(entry.created_at)}
                  </td>
                  <td className="px-2 py-3">
                    <button
                      onClick={() => remove(entry.email)}
                      disabled={deleting === entry.email}
                      className={BTN_ICON}
                      title="Remove"
                      aria-label={`Remove ${entry.email}`}
                    >
                      {deleting === entry.email ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.2">
                          <circle cx="6" cy="6" r="4.5" strokeOpacity="0.2" />
                          <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" strokeLinecap="round" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                          <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" />
                        </svg>
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {entries.length > 0 && (
        <p className="mt-3 text-[12px] text-[var(--foreground-subtle)] tracking-wide text-right">
          {entries.length} total · use &ldquo;Copy all&rdquo; to export to email tool
        </p>
      )}
    </div>
  );
}
