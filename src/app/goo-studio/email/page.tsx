"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import type { EmailTemplate } from "@/app/api/admin/email/templates/route";
import { buildHtml, footerKindFor, parseEmailList, textToHtml } from "@/lib/email-render";

type Audience = "all" | "free" | "basic" | "pro" | "premium" | "custom";

interface StatusData {
  configured: boolean;
  fromAddress: string;
  /** null when Clerk could not be read — see countsError. */
  counts: Record<string, number> | null;
  countsError?: string;
}

interface SendResult {
  ok: boolean;
  sent: number;
  total: number;
  errors?: string[];
  testOnly?: boolean;
}

// Only "custom" shows its description — the other cards show a recipient count.
const AUDIENCE_OPTIONS: { value: Audience; label: string; desc?: string }[] = [
  { value: "all",     label: "All users" },
  { value: "free",    label: "Free plan" },
  { value: "basic",   label: "Basic plan" },
  { value: "pro",     label: "Pro plan" },
  { value: "premium", label: "Premium plan" },
  { value: "custom",  label: "Custom emails", desc: "Paste email addresses below" },
];

const FORMAT_HELP: { input: string; output: string }[] = [
  { input: "# Heading",     output: "Email title (H1)" },
  { input: "## Subheading", output: "Section heading (H2)" },
  { input: "Plain text",    output: "Paragraph" },
  { input: "- Item",        output: "Bulleted list" },
  { input: "**bold**",      output: "Bold text" },
  { input: "*italic*",      output: "Italic text" },
  { input: "`code`",        output: "Inline code" },
  { input: "(empty line)",  output: "Space between paragraphs" },
];

const inputCls = "w-full rounded-lg border border-[var(--border)] focus:border-[var(--foreground)] outline-none px-3 py-2 text-sm bg-transparent text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)]";
const labelCls = "block text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2";

// Admin status recipe (DESIGN_SYSTEM.md §9)
const statusOk   = "bg-emerald-400/15 text-emerald-500 border border-emerald-400/30";
const statusWarn = "bg-amber-400/15 text-amber-500 border border-amber-400/30";
const statusErr  = "bg-red-400/15 text-red-500 border border-red-400/30";

export default function AdminEmailPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [statusError, setStatusError] = useState("");
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [audience, setAudience] = useState<Audience>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [customEmails, setCustomEmails] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showFormatHelp, setShowFormatHelp] = useState(false);

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);

  // AI writing
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiWriting, setAiWriting] = useState(false);
  const [aiWriteError, setAiWriteError] = useState("");

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [saveTemplateError, setSaveTemplateError] = useState("");
  // Guards against a second POST from a held Enter before the state re-renders.
  const savingTemplateRef = useRef(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/email");
        const data = await res.json().catch(() => null);
        if (res.ok && data) setStatus(data as StatusData);
        else setStatusError(data?.error ?? `Request failed (HTTP ${res.status}).`);
      } catch {
        setStatusError("Network error.");
      } finally {
        setLoadingStatus(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/email/templates");
        const data = await res.json().catch(() => null);
        if (res.ok && Array.isArray(data)) setTemplates(data);
        else setTemplatesError(data?.error ?? `Request failed (HTTP ${res.status}).`);
      } catch {
        setTemplatesError("Network error.");
      } finally {
        setLoadingTemplates(false);
      }
    })();
  }, []);

  const customParsed = useMemo(() => parseEmailList(customEmails), [customEmails]);

  const recipientCount =
    audience === "custom"
      ? customParsed.emails.length
      : (status?.counts?.[audience] ?? 0);

  // Rendered in the browser with the same helpers the send route uses.
  const previewHtml = useMemo(
    () => (showPreview
      ? buildHtml(subject.trim() || "(no subject)", textToHtml(body.trim()), footerKindFor(audience))
      : ""),
    [showPreview, subject, body, audience]
  );

  const sendEmail = async (testOnly: boolean) => {
    setResult(null);
    setSendError("");
    if (testOnly) setTestSending(true); else setSending(true);
    try {
      const res = await fetch("/api/admin/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audience,
          subject: subject.trim(),
          body: body.trim(),
          customEmails: audience === "custom" ? customParsed.emails : [],
          testOnly,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setResult(data as SendResult);
      } else {
        // No JSON means the request died mid-way (e.g. a gateway timeout),
        // possibly after some batches had already gone out.
        setSendError(
          data?.error ??
            `Request failed (HTTP ${res.status}).${testOnly ? "" : " Some emails may already have gone out — check the Resend dashboard before sending again."}`
        );
      }
    } catch {
      setSendError(
        testOnly
          ? "Network error — the test email may not have been sent."
          : "Network error — the request was interrupted. Some emails may already have gone out — check the Resend dashboard before sending again."
      );
    } finally {
      if (testOnly) setTestSending(false); else setSending(false);
      setConfirmSend(false);
    }
  };

  const handleAiWrite = async () => {
    setAiWriting(true);
    setAiWriteError("");
    try {
      const res = await fetch("/api/admin/email/ai-write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), brief: aiBrief.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) { setAiWriteError(data?.error ?? `Request failed (HTTP ${res.status}).`); return; }
      setBody(data.body ?? "");
      setShowAiModal(false);
      setAiBrief("");
    } catch {
      setAiWriteError("Network error.");
    } finally {
      setAiWriting(false);
    }
  };

  const handleLoadTemplate = (t: EmailTemplate) => {
    const hasDraft = subject.trim() || body.trim();
    const isSame = subject === t.subject && body === t.body;
    if (hasDraft && !isSame && !confirm(`Replace the current subject and body with "${t.name}"?`)) return;
    setSubject(t.subject);
    setBody(t.body);
    setShowPreview(false);
    setResult(null);
    setSendError("");
  };

  const handleSaveTemplate = async () => {
    if (savingTemplateRef.current) return;
    if (!templateName.trim() || !subject.trim() || !body.trim()) return;
    savingTemplateRef.current = true;
    setSavingTemplate(true);
    setSaveTemplateError("");
    try {
      const res = await fetch("/api/admin/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName.trim(), subject: subject.trim(), body: body.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setTemplates((prev) => [data as EmailTemplate, ...prev]);
        setShowSaveModal(false);
        setTemplateName("");
      } else {
        setSaveTemplateError(data?.error ?? `Request failed (HTTP ${res.status}).`);
      }
    } catch {
      setSaveTemplateError("Network error.");
    } finally {
      savingTemplateRef.current = false;
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    setDeletingId(id);
    setTemplatesError("");
    try {
      const res = await fetch(`/api/admin/email/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      } else {
        const data = await res.json().catch(() => null);
        setTemplatesError(`Delete failed: ${data?.error ?? `HTTP ${res.status}`}`);
      }
    } catch {
      setTemplatesError("Delete failed: network error.");
    } finally {
      setDeletingId(null);
    }
  };

  const canSend = subject.trim() && body.trim() && audience &&
    (audience !== "custom" || customParsed.emails.length > 0) &&
    status?.configured;

  const failedBatches = result?.errors?.length ?? 0;

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-light text-[var(--foreground)]">Email</h1>
        <p className="text-xs text-[var(--foreground-muted)] mt-1">
          Broadcast to your users via Resend — each recipient gets an individual copy
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8 items-start">

        {/* ── Left: compose ── */}
        <div className="space-y-8">

          {/* Status banner */}
          {!loadingStatus && statusError && (
            <div className={`rounded-xl px-5 py-4 text-xs ${statusErr}`}>
              <span className="font-medium">Couldn&apos;t load email settings.</span> {statusError}
            </div>
          )}
          {!loadingStatus && status && (
            <div className={`rounded-xl flex items-start gap-4 px-5 py-4 text-xs ${
              status.configured
                ? "border border-[var(--border)] bg-[var(--background)]"
                : statusWarn
            }`}>
              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${status.configured ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div className="flex-1 min-w-0">
                {status.configured ? (
                  <p className="text-[var(--foreground-muted)]">
                    Sending from <span className="text-[var(--foreground)] font-medium">{status.fromAddress}</span> via Resend
                    <span className="ml-2 text-[var(--foreground-subtle)]">· each recipient sent individually</span>
                  </p>
                ) : (
                  <p>
                    <span className="font-medium">Resend not configured.</span>{" "}
                    Add <code className="bg-[var(--surface)] px-1">RESEND_API_KEY</code> to your environment variables.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Audience selector */}
          <div>
            <label className={labelCls}>Audience</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AUDIENCE_OPTIONS.map((opt) => {
                const count = opt.value === "custom" ? null : status?.counts?.[opt.value];
                return (
                  <button
                    key={opt.value}
                    onClick={() => { setAudience(opt.value); setResult(null); setSendError(""); }}
                    className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                      audience === opt.value
                        ? "border-[var(--foreground)] bg-[var(--surface)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)] bg-[var(--background)]"
                    }`}
                  >
                    <p className="text-xs font-medium text-[var(--foreground)] mb-0.5">{opt.label}</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)]">
                      {opt.desc ?? (count != null
                        ? `${count} recipient${count !== 1 ? "s" : ""}`
                        : loadingStatus ? "…" : "Count unavailable")}
                    </p>
                  </button>
                );
              })}
            </div>

            {status?.countsError && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${statusErr}`}>
                Couldn&apos;t load the audience from Clerk: {status.countsError}. Reload the page to retry — Custom emails still work.
              </p>
            )}

            {audience === "custom" && (
              <div className="mt-3">
                <textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder="Paste email addresses, comma or newline separated"
                  rows={4}
                  className={`${inputCls} resize-none font-mono`}
                />
                {(customParsed.emails.length > 0 || customParsed.skipped > 0) && (
                  <p className="mt-1 text-[10px] text-[var(--foreground-subtle)]">
                    {customParsed.emails.length} valid address{customParsed.emails.length !== 1 ? "es" : ""}
                    {customParsed.skipped > 0 && ` · ${customParsed.skipped} skipped (invalid or duplicate)`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Compose */}
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. New features in GOO this month"
                className={inputCls}
              />
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <label className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                  Body
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  {/* The "?" guide says the same on phones, where this line does not fit. */}
                  <span className="hidden sm:inline text-[10px] text-[var(--foreground-subtle)]">
                    Supports # h1 &nbsp;## h2 &nbsp;- lists &nbsp;**bold** &nbsp;*italic*
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFormatHelp((v) => !v)}
                    aria-expanded={showFormatHelp}
                    aria-label="Formatting help"
                    title="Formatting help"
                    className="w-5 h-5 rounded-full border border-[var(--border)] flex items-center justify-center text-[10px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                  >
                    ?
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAiWriteError(""); setShowAiModal(true); }}
                    className="inline-flex items-center gap-1.5 rounded-lg text-[10px] tracking-[0.12em] uppercase border border-[var(--border)] px-2.5 py-1 text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.1" />
                      <path d="M3.5 5C3.5 4.17 4.17 3.5 5 3.5C5.83 3.5 6.5 4.17 6.5 5C6.5 5.83 5.83 6.5 5 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                      <circle cx="5" cy="5" r="0.8" fill="currentColor" />
                    </svg>
                    AI Write
                  </button>
                </div>
              </div>

              {/* Format guide — behind the "?" toggle */}
              {showFormatHelp && (
                <div className="mb-2 rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
                  <div className="px-3 py-2 flex items-center justify-between">
                    <p className="text-[10px] tracking-[0.18em] uppercase text-[var(--foreground-subtle)]">Formatting</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)]">you type → the email shows</p>
                  </div>
                  {FORMAT_HELP.map(({ input, output }) => (
                    <div key={input} className="grid grid-cols-[1fr_1fr] px-3 py-1.5 gap-4">
                      <code className="text-[11px] text-[var(--foreground-muted)] font-mono">{input}</code>
                      <span className="text-[11px] text-[var(--foreground-subtle)]">{output}</span>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={"# Hello from GOO\n\nWrite your message here. Supports basic markdown.\n\n## What's new\n\n- Feature one\n- Feature two"}
                rows={12}
                className={`${inputCls} resize-y font-mono leading-relaxed`}
              />
            </div>
          </div>

          {/* Preview toggle */}
          <div>
            <button
              onClick={() => setShowPreview((v) => !v)}
              disabled={!showPreview && (!subject.trim() || !body.trim())}
              className="rounded-lg text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-5 py-2.5 hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {showPreview ? "Hide preview" : "Show email preview"}
            </button>

            {showPreview && previewHtml && (
              <div className="mt-4 rounded-xl border border-[var(--border)] overflow-hidden">
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

          {/* Send controls */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => sendEmail(true)}
              disabled={!canSend || testSending || sending}
              className="rounded-lg text-xs tracking-[0.12em] uppercase text-[var(--foreground)] border border-[var(--border)] px-5 py-2.5 hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testSending ? (
                <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Sending test…</>
              ) : "Send test to me"}
            </button>

            {!confirmSend ? (
              <button
                onClick={() => setConfirmSend(true)}
                disabled={!canSend || testSending || sending || recipientCount === 0}
                className="rounded-lg text-xs tracking-[0.12em] uppercase text-[var(--background)] bg-[var(--foreground)] px-5 py-2.5 hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Send to {recipientCount > 0 ? `${recipientCount} recipient${recipientCount !== 1 ? "s" : ""}` : "audience"}
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs text-[var(--foreground-muted)]">
                  Send to <strong className="text-[var(--foreground)]">{recipientCount}</strong> {recipientCount === 1 ? "person" : "people"}?
                </span>
                <button
                  onClick={() => sendEmail(false)}
                  disabled={sending}
                  className="rounded-lg text-xs tracking-[0.12em] uppercase text-[var(--background)] bg-[var(--foreground)] px-4 py-2 hover:opacity-80 disabled:opacity-40 transition-opacity flex items-center gap-2"
                >
                  {sending ? (
                    <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Sending…</>
                  ) : "Confirm send"}
                </button>
                <button
                  onClick={() => setConfirmSend(false)}
                  disabled={sending}
                  className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Result */}
          {sendError && (
            <div className={`rounded-xl px-5 py-4 text-sm ${statusErr}`}>
              <p className="font-medium">Send failed.</p>
              <p className="text-xs mt-1">{sendError}</p>
            </div>
          )}
          {result && (
            <div className={`rounded-xl px-5 py-4 text-sm ${result.ok ? statusOk : statusErr}`}>
              {result.ok ? (
                <p>
                  {result.testOnly
                    ? `Test email sent to your address.`
                    : `Sent to ${result.sent} of ${result.total} recipient${result.total !== 1 ? "s" : ""} individually — addresses not visible to each other.`}
                </p>
              ) : (
                <div>
                  <p className="font-medium mb-1">
                    {result.testOnly
                      ? "Test email was not sent."
                      : `Sent ${result.sent} of ${result.total} — ${failedBatches} batch${failedBatches !== 1 ? "es" : ""} failed.`}
                  </p>
                  {result.errors?.map((err, i) => (
                    <p key={i} className="text-xs mt-1">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: templates ── */}
        <div className="rounded-xl border border-[var(--border)]" style={{ background: "var(--background)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
              Templates
            </p>
            <button
              onClick={() => { setTemplateName(""); setSaveTemplateError(""); setShowSaveModal(true); }}
              disabled={!subject.trim() || !body.trim()}
              title="Save current draft as template"
              aria-label="Save current draft as template"
              className="flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1V13M1 7H13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {templatesError && (
            <p className={`mx-4 my-3 rounded-lg px-3 py-2 text-[11px] ${statusErr}`}>{templatesError}</p>
          )}

          <div className="divide-y divide-[var(--border)]">
            {loadingTemplates ? (
              <div className="px-4 py-6 text-center text-[11px] text-[var(--foreground-subtle)] animate-pulse">
                Loading…
              </div>
            ) : templates.length === 0 ? (
              !templatesError && (
                <div className="px-4 py-8 text-center">
                  <p className="text-[11px] text-[var(--foreground-subtle)]">No templates yet.</p>
                  <p className="text-[10px] text-[var(--foreground-subtle)] mt-1 opacity-60">
                    Fill in a subject + body above, then click + to save.
                  </p>
                </div>
              )
            ) : (
              templates.map((t) => (
                <div key={t.id} className="px-4 py-3 group hover:bg-[var(--surface)] transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[var(--foreground)] truncate">{t.name}</p>
                      <p className="text-[10px] text-[var(--foreground-muted)] truncate mt-0.5">{t.subject}</p>
                    </div>
                    {/* Revealed on hover where there is a pointer; always shown on
                        touch screens, which have no hover, and while focused. */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity shrink-0">
                      <button
                        onClick={() => handleLoadTemplate(t)}
                        title="Load into editor"
                        aria-label={`Load template ${t.name} into the editor`}
                        className="p-1 flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(t.id)}
                        disabled={deletingId === t.id}
                        title="Delete template"
                        aria-label={`Delete template ${t.name}`}
                        className="p-1 flex items-center justify-center text-[var(--foreground-muted)] hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* AI Write modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Write with AI"
            className="rounded-2xl border border-[var(--border)] w-full max-w-md max-h-[90dvh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="font-display text-lg font-light text-[var(--foreground)]">Write with AI</h2>
                <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">
                  Describe what to write — AI generates the email body
                </p>
              </div>
              <button onClick={() => setShowAiModal(false)} aria-label="Close" className="flex items-center justify-center shrink-0 text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {subject && (
                <div className="text-[10px] text-[var(--foreground-subtle)] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                  Subject: <span className="text-[var(--foreground-muted)]">{subject}</span>
                </div>
              )}
              <div>
                <label className={labelCls}>Brief — what should the email say?</label>
                <textarea
                  value={aiBrief}
                  onChange={(e) => setAiBrief(e.target.value)}
                  placeholder={"e.g. Announce new summer collection, mention free shipping this week, include styling tips for hot weather"}
                  rows={4}
                  className={`${inputCls} resize-none`}
                  autoFocus
                  disabled={aiWriting}
                />
              </div>
              {aiWriteError && <p className={`rounded-lg px-3 py-2 text-xs ${statusErr}`}>{aiWriteError}</p>}
              {aiWriting && (
                <p className="text-xs text-[var(--foreground-muted)] animate-pulse">Writing your email…</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={handleAiWrite}
                disabled={(!subject.trim() && !aiBrief.trim()) || aiWriting}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-2.5 text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2 rounded-lg"
              >
                {aiWriting
                  ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Writing…</>
                  : "Generate body"}
              </button>
              <button
                onClick={() => setShowAiModal(false)}
                disabled={aiWriting}
                className="border border-[var(--border)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Save template modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Save template"
            className="rounded-2xl border border-[var(--border)] w-full max-w-sm max-h-[90dvh] overflow-y-auto"
            style={{ background: "var(--background)" }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <h2 className="font-display text-lg font-light text-[var(--foreground)]">Save template</h2>
              <button
                onClick={() => setShowSaveModal(false)}
                aria-label="Close"
                className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className={labelCls}>Template name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.repeat) handleSaveTemplate(); }}
                  placeholder="e.g. Monthly newsletter"
                  className={inputCls}
                  autoFocus
                />
              </div>
              <div className="text-[10px] text-[var(--foreground-subtle)] space-y-0.5">
                <p><span className="text-[var(--foreground-muted)]">Subject:</span> {subject}</p>
                <p><span className="text-[var(--foreground-muted)]">Body:</span> {body.slice(0, 60)}{body.length > 60 ? "…" : ""}</p>
              </div>
              {saveTemplateError && (
                <p className={`rounded-lg px-3 py-2 text-xs ${statusErr}`}>Couldn&apos;t save the template: {saveTemplateError}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-[var(--border)] flex gap-3">
              <button
                onClick={handleSaveTemplate}
                disabled={!templateName.trim() || savingTemplate}
                className="flex-1 bg-[var(--foreground)] text-[var(--background)] py-2.5 text-xs tracking-[0.12em] uppercase hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity rounded-lg"
              >
                {savingTemplate ? "Saving…" : "Save template"}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="border border-[var(--border)] px-4 py-2.5 text-xs tracking-[0.12em] uppercase text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
