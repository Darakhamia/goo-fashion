"use client";

import { useState, useEffect, useCallback } from "react";

type Audience = "all" | "free" | "basic" | "pro" | "premium" | "custom";

interface StatusData {
  configured: boolean;
  fromAddress: string;
  counts: Record<string, number>;
}

interface SendResult {
  ok: boolean;
  sent: number;
  total: number;
  errors?: string[];
  testOnly?: boolean;
}

const AUDIENCE_OPTIONS: { value: Audience; label: string; desc: string }[] = [
  { value: "all",     label: "All users",     desc: "Everyone with an account" },
  { value: "free",    label: "Free plan",     desc: "Users on the free tier" },
  { value: "basic",   label: "Basic plan",    desc: "Basic subscribers" },
  { value: "pro",     label: "Pro plan",      desc: "Pro subscribers" },
  { value: "premium", label: "Premium plan",  desc: "Premium subscribers" },
  { value: "custom",  label: "Custom emails", desc: "Paste email addresses below" },
];

export default function AdminEmailPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [audience, setAudience] = useState<Audience>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [customEmails, setCustomEmails] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  useEffect(() => {
    fetch("/api/admin/email")
      .then((r) => r.json())
      .then((d) => setStatus(d))
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));
  }, []);

  const recipientCount =
    audience === "custom"
      ? customEmails.split(/[\n,]/).filter((e) => e.trim().includes("@")).length
      : (status?.counts[audience] ?? 0);

  const buildPreview = useCallback(async () => {
    const res = await fetch("/api/admin/email/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body }),
    }).catch(() => null);

    if (res?.ok) {
      const data = await res.json();
      setPreviewHtml(data.html ?? "");
    }
  }, [subject, body]);

  const handlePreviewToggle = async () => {
    if (!showPreview) await buildPreview();
    setShowPreview((v) => !v);
  };

  const sendEmail = async (testOnly: boolean) => {
    setResult(null);
    if (testOnly) setTestSending(true); else setSending(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          subject: subject.trim(),
          body: body.trim(),
          customEmails: audience === "custom"
            ? customEmails.split(/[\n,]/).map((e) => e.trim()).filter((e) => e.includes("@"))
            : [],
          testOnly,
        }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      if (testOnly) setTestSending(false); else setSending(false);
      setConfirmSend(false);
    }
  };

  const canSend = subject.trim() && body.trim() && audience &&
    (audience !== "custom" || customEmails.trim()) &&
    status?.configured;

  return (
    <div className="max-w-4xl space-y-8">

      {/* ── Status banner ── */}
      {!loadingStatus && status && (
        <div className={`flex items-start gap-4 px-5 py-4 border text-xs ${
          status.configured
            ? "border-[var(--border)] bg-[var(--background)]"
            : "border-amber-300/40 bg-amber-50/5"
        }`}>
          <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${status.configured ? "bg-emerald-500" : "bg-amber-400"}`} />
          <div className="flex-1 min-w-0">
            {status.configured ? (
              <p className="text-[var(--foreground-muted)]">
                Sending from <span className="text-[var(--foreground)] font-medium">{status.fromAddress}</span> via Resend
              </p>
            ) : (
              <p className="text-amber-400">
                <span className="font-medium">Resend not configured.</span>{" "}
                Add <code className="bg-[var(--surface)] px-1">RESEND_API_KEY</code> to your environment variables.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Audience selector ── */}
      <div>
        <label className="block text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
          Audience
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AUDIENCE_OPTIONS.map((opt) => {
            const count = opt.value === "custom" ? null : (status?.counts[opt.value] ?? 0);
            return (
              <button
                key={opt.value}
                onClick={() => { setAudience(opt.value); setResult(null); }}
                className={`text-left px-4 py-3 border transition-colors ${
                  audience === opt.value
                    ? "border-[var(--foreground)] bg-[var(--surface)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)]"
                }`}
              >
                <p className="text-xs font-medium text-[var(--foreground)] mb-0.5">{opt.label}</p>
                <p className="text-[10px] text-[var(--foreground-subtle)]">
                  {count !== null ? `${count} recipient${count !== 1 ? "s" : ""}` : opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {audience === "custom" && (
          <div className="mt-3">
            <textarea
              value={customEmails}
              onChange={(e) => setCustomEmails(e.target.value)}
              placeholder="Paste email addresses, comma or newline separated"
              rows={4}
              className="w-full px-4 py-3 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] resize-none font-mono"
            />
            {recipientCount > 0 && (
              <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">{recipientCount} valid address{recipientCount !== 1 ? "es" : ""} detected</p>
            )}
          </div>
        )}
      </div>

      {/* ── Compose ── */}
      <div className="space-y-4">
        <div>
          <label className="block text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. New features in GOO this month"
            className="w-full px-4 py-3 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)]"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
              Body
            </label>
            <span className="text-[9px] text-[var(--foreground-subtle)] tracking-[0.06em]">
              Supports # h1 &nbsp;## h2 &nbsp;- lists &nbsp;**bold** &nbsp;*italic* &nbsp;`code`
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={"# Hello from GOO\n\nWrite your message here. Supports basic markdown.\n\n## What's new\n\n- Feature one\n- Feature two"}
            rows={12}
            className="w-full px-4 py-3 text-sm bg-[var(--background)] border border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] resize-y font-mono leading-relaxed"
          />
        </div>
      </div>

      {/* ── Preview toggle ── */}
      <div>
        <button
          onClick={handlePreviewToggle}
          disabled={!subject.trim() || !body.trim()}
          className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-5 py-2.5 hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {showPreview ? "Hide preview" : "Show email preview"}
        </button>

        {showPreview && previewHtml && (
          <div className="mt-4 border border-[var(--border)] overflow-hidden">
            <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
              <span className="ml-2 text-[10px] text-[var(--foreground-subtle)]">Email preview</span>
            </div>
            <iframe
              srcDoc={previewHtml}
              title="Email preview"
              className="w-full"
              style={{ height: 600, border: "none" }}
            />
          </div>
        )}
      </div>

      {/* ── Send controls ── */}
      <div className="flex flex-wrap items-center gap-4 pt-2">
        <button
          onClick={() => sendEmail(true)}
          disabled={!canSend || testSending || sending}
          className="text-xs tracking-[0.12em] uppercase text-[var(--foreground)] border border-[var(--border)] px-5 py-2.5 hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {testSending ? (
            <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Sending test…</>
          ) : "Send test to me"}
        </button>

        {!confirmSend ? (
          <button
            onClick={() => setConfirmSend(true)}
            disabled={!canSend || testSending || sending || recipientCount === 0}
            className="text-xs tracking-[0.12em] uppercase text-[var(--background)] bg-[var(--foreground)] px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send to {recipientCount > 0 ? `${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}` : "audience"}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--foreground-muted)]">
              Send to <strong className="text-[var(--foreground)]">{recipientCount}</strong> {recipientCount === 1 ? "person" : "people"}?
            </span>
            <button
              onClick={() => sendEmail(false)}
              disabled={sending}
              className="text-xs tracking-[0.12em] uppercase text-[var(--background)] bg-[var(--foreground)] px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2"
            >
              {sending ? (
                <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Sending…</>
              ) : "Confirm send"}
            </button>
            <button
              onClick={() => setConfirmSend(false)}
              className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── Result ── */}
      {result && (
        <div className={`px-5 py-4 border text-sm ${
          result.ok
            ? "border-emerald-500/30 bg-emerald-500/5"
            : "border-red-400/30 bg-red-400/5"
        }`}>
          {result.ok ? (
            <p className="text-emerald-400">
              {result.testOnly
                ? `Test email sent to your address.`
                : `Sent to ${result.sent} of ${result.total} recipient${result.total !== 1 ? "s" : ""}.`}
            </p>
          ) : (
            <div>
              <p className="text-red-400 font-medium mb-1">
                Sent {result.sent} of {result.total} — {result.errors?.length} batch{(result.errors?.length ?? 0) > 1 ? "es" : ""} failed.
              </p>
              {result.errors?.map((err, i) => (
                <p key={i} className="text-xs text-[var(--foreground-muted)] mt-1">{err}</p>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
