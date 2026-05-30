"use client";

import { useEffect, useState } from "react";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
}

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/waitlist")
      .then((r) => r.json())
      .then((d) => setEntries(Array.isArray(d) ? d : []))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const remove = async (email: string) => {
    setDeleting(email);
    await fetch("/api/admin/waitlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setEntries((prev) => prev.filter((e) => e.email !== email));
    setDeleting(null);
  };

  const copyAll = () => {
    const text = entries.map((e) => e.email).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] tracking-[0.22em] uppercase text-[var(--foreground-subtle)] mb-1">Coming Soon</p>
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">Waitlist</h1>
          <p className="text-[12px] text-[var(--foreground-muted)] mt-1">
            {loading ? "Loading…" : `${entries.length} email${entries.length !== 1 ? "s" : ""} collected`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyAll}
            disabled={entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-[11px] tracking-[0.1em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-30"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="8" height="8" rx="1" />
              <path d="M2 10V2h8" />
            </svg>
            {copied ? "Copied!" : "Copy all"}
          </button>
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 text-[11px] tracking-[0.1em] uppercase border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4H8M2 12v-4h4" />
              <path d="M12 6A5 5 0 1 0 8 12" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="border border-[var(--border)] bg-[var(--background)]">
        {/* Table head */}
        <div className="grid grid-cols-[1fr_160px_40px] px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
          <span className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Email</span>
          <span className="text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">Signed up</span>
          <span />
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" className="animate-spin text-[var(--foreground-subtle)]" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="10" cy="10" r="8" strokeOpacity="0.2" />
              <path d="M10 2a8 8 0 0 1 8 8" strokeLinecap="round" />
            </svg>
          </div>
        ) : entries.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[11px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">No entries yet</p>
            <p className="text-[12px] text-[var(--foreground-subtle)] mt-2 opacity-60">Emails will appear here when people sign up on the coming-soon page</p>
          </div>
        ) : (
          <ul>
            {entries.map((entry, i) => (
              <li
                key={entry.id ?? entry.email}
                className={`grid grid-cols-[1fr_160px_40px] items-center px-5 py-3.5 hover:bg-[var(--surface)] transition-colors ${
                  i < entries.length - 1 ? "border-b border-[var(--border)]" : ""
                }`}
              >
                <span className="text-[13px] text-[var(--foreground)] font-mono">{entry.email}</span>
                <span className="text-[11px] text-[var(--foreground-muted)]">
                  {entry.created_at
                    ? new Date(entry.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    : "—"}
                </span>
                <button
                  onClick={() => remove(entry.email)}
                  disabled={deleting === entry.email}
                  className="flex items-center justify-center w-7 h-7 text-[var(--foreground-subtle)] hover:text-red-400 transition-colors disabled:opacity-30"
                  title="Remove"
                >
                  {deleting === entry.email ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin" fill="none" stroke="currentColor" strokeWidth="1.3">
                      <circle cx="6" cy="6" r="4.5" strokeOpacity="0.2" />
                      <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
                      <path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {entries.length > 0 && (
        <p className="mt-3 text-[10px] text-[var(--foreground-subtle)] tracking-wide text-right">
          {entries.length} total · use &ldquo;Copy all&rdquo; to export to email tool
        </p>
      )}
    </div>
  );
}
