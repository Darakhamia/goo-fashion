"use client";

import { Fragment, useState, useEffect, useMemo, useRef } from "react";
import type { EmailTemplate } from "@/app/api/admin/email/templates/route";
import { buildHtml, footerKindFor, parseEmailList, textToHtml } from "@/lib/email-render";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { btn, BTN_ICON, FIELD_LABEL, INPUT } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";
import type { Key, Vars } from "@/app/goo-studio/_i18n";
import { AdminPage } from "@/components/admin/AdminPage";
import { EmptyState } from "@/components/admin/DataTable";
import { FilterChips } from "@/components/admin/FilterBar";
import { FormPanel, FormSection } from "@/components/admin/FormSection";
import { HelpButton, HelpPanel, useHelp } from "@/components/admin/HelpToggle";
import { Modal } from "@/components/admin/Modal";
import { PageHeader } from "@/components/admin/PageHeader";

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

/**
 * A message to show: the server's own words as they came, or a dictionary key.
 * The loads run once, so what they set is kept as a key and still follows the
 * admin language after a switch.
 */
type Msg = string | { key: Key; vars?: Vars };

// The audience chips; every one but "custom" shows its recipient count.
const AUDIENCE_OPTIONS: { value: Audience; label: Key }[] = [
  { value: "all",     label: "email.audience.all" },
  { value: "free",    label: "plan.free" },
  { value: "basic",   label: "plan.basic" },
  { value: "pro",     label: "plan.pro" },
  { value: "premium", label: "plan.premium" },
  { value: "custom",  label: "email.audience.custom" },
];

const FORMAT_HELP: { input: Key; output: Key }[] = [
  { input: "email.format.h1.in",     output: "email.format.h1.out" },
  { input: "email.format.h2.in",     output: "email.format.h2.out" },
  { input: "email.format.text.in",   output: "email.format.text.out" },
  { input: "email.format.list.in",   output: "email.format.list.out" },
  { input: "email.format.bold.in",   output: "email.format.bold.out" },
  { input: "email.format.italic.in", output: "email.format.italic.out" },
  { input: "email.format.code.in",   output: "email.format.code.out" },
  { input: "email.format.blank.in",  output: "email.format.blank.out" },
];

const fieldCls = `${INPUT} w-full`;

// Banners follow the admin's banner recipe (DESIGN_SYSTEM.md §9).
const bannerErr = "rounded-xl border border-[var(--err-line)] bg-[var(--err-bg)] px-4 py-3 text-[13px] text-[var(--err)]";
const bannerWarn = "rounded-xl border border-[var(--warn-line)] bg-[var(--warn-bg)] px-4 py-3 text-[13px] text-[var(--warn)]";
const bannerOk = "rounded-xl border border-[var(--ok-line)] bg-[var(--ok-bg)] px-4 py-3 text-[13px] text-[var(--ok)]";

const SPINNER = <span aria-hidden="true" className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />;

const CLOSE_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

export default function AdminEmailPage() {
  const t = useT();
  const say = (m: Msg) => (typeof m === "string" ? m : t(m.key, m.vars));
  const confirm = useConfirm();
  const formatHelp = useHelp("email-format");
  const [status, setStatus] = useState<StatusData | null>(null);
  const [statusError, setStatusError] = useState<Msg | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [audience, setAudience] = useState<Audience>("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [customEmails, setCustomEmails] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [sending, setSending] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [sendError, setSendError] = useState("");

  // AI writing
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiBrief, setAiBrief] = useState("");
  const [aiWriting, setAiWriting] = useState(false);
  const [aiWriteError, setAiWriteError] = useState("");

  // Templates
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templatesError, setTemplatesError] = useState<Msg | null>(null);
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
        else setStatusError(data?.error ?? { key: "email.requestFailed", vars: { status: res.status } });
      } catch {
        setStatusError({ key: "common.networkError" });
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
        else setTemplatesError(data?.error ?? { key: "email.requestFailed", vars: { status: res.status } });
      } catch {
        setTemplatesError({ key: "common.networkError" });
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
      ? buildHtml(subject.trim() || t("email.preview.noSubject"), textToHtml(body.trim()), footerKindFor(audience))
      : ""),
    [showPreview, subject, body, audience, t]
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
            [t("email.requestFailed", { status: res.status }), ...(testOnly ? [] : [t("email.send.maybeSent")])].join(" ")
        );
      }
    } catch {
      setSendError(testOnly ? t("email.send.networkTest") : t("email.send.networkAll"));
    } finally {
      if (testOnly) setTestSending(false); else setSending(false);
    }
  };

  // A broadcast cannot be called back, so it is asked for once more.
  const handleSend = async () => {
    if (!(await confirm({
      title: t("email.confirm.title", { count: recipientCount }),
      body: t("email.confirm.body", { subject: subject.trim() }),
      confirmLabel: t("email.confirm.action"),
      tone: "danger",
    }))) return;
    await sendEmail(false);
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
      if (!res.ok || !data) { setAiWriteError(data?.error ?? t("email.requestFailed", { status: res.status })); return; }
      setBody(data.body ?? "");
      setShowAiModal(false);
      setAiBrief("");
    } catch {
      setAiWriteError(t("common.networkError"));
    } finally {
      setAiWriting(false);
    }
  };

  const handleLoadTemplate = async (tpl: EmailTemplate) => {
    const hasDraft = subject.trim() || body.trim();
    const isSame = subject === tpl.subject && body === tpl.body;
    if (hasDraft && !isSame && !(await confirm({
      title: t("email.templates.replaceTitle", { name: tpl.name }),
      confirmLabel: t("email.templates.replaceAction"),
      tone: "danger",
    }))) return;
    setSubject(tpl.subject);
    setBody(tpl.body);
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
        setSaveTemplateError(data?.error ?? t("email.requestFailed", { status: res.status }));
      }
    } catch {
      setSaveTemplateError(t("common.networkError"));
    } finally {
      savingTemplateRef.current = false;
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!(await confirm({
      title: t("email.templates.deleteTitle", { name: templates.find((x) => x.id === id)?.name ?? "" }),
      confirmLabel: t("email.templates.delete"),
      tone: "danger",
    }))) return;
    setDeletingId(id);
    setTemplatesError(null);
    try {
      const res = await fetch(`/api/admin/email/templates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) {
        setTemplates((prev) => prev.filter((x) => x.id !== id));
      } else {
        const data = await res.json().catch(() => null);
        setTemplatesError({ key: "email.templates.deleteFailed", vars: { error: data?.error ?? `HTTP ${res.status}` } });
      }
    } catch {
      setTemplatesError({ key: "email.templates.deleteNetwork" });
    } finally {
      setDeletingId(null);
    }
  };

  const canSend = subject.trim() && body.trim() && audience &&
    (audience !== "custom" || customParsed.emails.length > 0) &&
    status?.configured;

  const failedBatches = result?.errors?.length ?? 0;

  // ── Right column: templates ──
  const templatesPanel = (
    <section
      aria-labelledby="email-templates-title"
      className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--surface)]"
    >
      <div className="flex items-center gap-2 pl-4 pr-2 py-2.5 border-b border-[var(--border)]">
        <h2 id="email-templates-title" className="flex-1 text-[15px] leading-[22px] font-medium text-[var(--foreground)]">
          {t("email.templates.title")}
        </h2>
        <button
          type="button"
          onClick={() => { setTemplateName(""); setSaveTemplateError(""); setShowSaveModal(true); }}
          disabled={!subject.trim() || !body.trim()}
          title={t("email.templates.saveCurrentHint")}
          className={btn("ghost")}
        >
          {t("email.templates.saveCurrent")}
        </button>
      </div>

      {templatesError && (
        <p role="alert" className="px-4 py-3 border-b border-[var(--border)] text-[12px] leading-[18px] text-[var(--err)] break-words">
          {say(templatesError)}
        </p>
      )}

      {loadingTemplates ? (
        <p className="px-4 py-6 text-center text-[13px] text-[var(--foreground-subtle)]">{t("common.loading")}</p>
      ) : templates.length === 0 ? (
        !templatesError && (
          <EmptyState
            text={t("email.templates.empty")}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 6.5h16v11H4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M4 7l8 6 8-6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            }
          />
        )
      ) : (
        <ul>
          {templates.map((tpl, i) => (
            <li
              key={tpl.id}
              className={`group flex items-start justify-between gap-2 px-4 py-3 hover:bg-[var(--fg-overlay-05)] transition-colors ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-5 font-medium text-[var(--foreground)] truncate" title={tpl.name}>{tpl.name}</p>
                <p className="text-[12px] leading-[18px] text-[var(--foreground-muted)] truncate" title={tpl.subject}>{tpl.subject}</p>
              </div>
              {/* Revealed on hover where there is a pointer; always shown on
                  touch screens, which have no hover, and while focused. */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => handleLoadTemplate(tpl)}
                  title={t("email.templates.load")}
                  aria-label={t("email.templates.loadNamed", { name: tpl.name })}
                  className={BTN_ICON}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  disabled={deletingId === tpl.id}
                  title={t("email.templates.delete")}
                  aria-label={t("email.templates.deleteNamed", { name: tpl.name })}
                  className={BTN_ICON}
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M2 2L10 10M10 2L2 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div>
      <PageHeader
        title={t("nav.email")}
        subtitle={
          loadingStatus
            ? t("common.loading")
            : status?.configured
              ? t("email.subtitle.from", { from: status.fromAddress })
              : t("email.subtitle")
        }
      />

      <AdminPage layout="form" aside={templatesPanel}>
        <div className="flex flex-col gap-4">
          {/* Status: only what stops a send is shown; a working setup is the header's line. */}
          {!loadingStatus && statusError && (
            <div role="alert" className={bannerErr}>
              <span className="font-medium">{t("email.loadFailed")}</span> {say(statusError)}
            </div>
          )}
          {!loadingStatus && status && !status.configured && (
            <div className={bannerWarn}>
              <span className="font-medium">{t("email.notConfigured")}</span> {t("email.notConfiguredHint")}{" "}
              <code className="font-mono">{"RESEND_API_KEY"}</code>
            </div>
          )}

          <FormPanel>
            {/* Audience */}
            <FormSection id="audience" title={t("email.audience")} description={t("email.audience.hint")}>
              <FilterChips
                label={t("email.audience")}
                value={audience}
                options={AUDIENCE_OPTIONS.map((opt) => ({
                  value: opt.value,
                  label: t(opt.label),
                  count: opt.value === "custom" ? undefined : status?.counts?.[opt.value],
                }))}
                onChange={(v) => { setAudience(v as Audience); setResult(null); setSendError(""); }}
              />

              {status?.countsError && (
                <p role="alert" className={bannerErr}>
                  {t("email.countsFailed", { error: status.countsError })}
                </p>
              )}

              {audience === "custom" && (
                <div>
                  <textarea
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    aria-label={t("email.custom.label")}
                    placeholder={t("email.custom.placeholder")}
                    rows={4}
                    className={`${fieldCls} resize-none font-mono`}
                  />
                  {(customParsed.emails.length > 0 || customParsed.skipped > 0) && (
                    <p className="mt-1 text-[12px] text-[var(--foreground-subtle)]">
                      {[
                        t("email.custom.valid", { count: customParsed.emails.length }),
                        ...(customParsed.skipped > 0 ? [t("email.custom.skipped", { count: customParsed.skipped })] : []),
                      ].join(" · ")}
                    </p>
                  )}
                </div>
              )}
            </FormSection>

            {/* Message */}
            <FormSection
              id="message"
              title={t("email.message")}
              description={t("email.message.hint")}
              extra={<HelpButton help={formatHelp} label={t("email.format.help")} />}
            >
              {/* Format guide — behind the "?" */}
              <HelpPanel help={formatHelp}>
                <p className="flex flex-wrap justify-between gap-x-4">
                  <span className="font-medium text-[var(--foreground)]">{t("email.format.title")}</span>
                  <span>{t("email.format.caption")}</span>
                </p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {FORMAT_HELP.map(({ input, output }) => (
                    <Fragment key={input}>
                      <dt>
                        <code className="font-mono text-[12px] text-[var(--foreground)]">{t(input)}</code>
                      </dt>
                      <dd className="text-[12px]">{t(output)}</dd>
                    </Fragment>
                  ))}
                </dl>
              </HelpPanel>

              <div>
                <label htmlFor="email-subject" className={FIELD_LABEL}>{t("email.subject")}</label>
                <input
                  id="email-subject"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={t("email.subject.placeholder")}
                  className={fieldCls}
                />
              </div>

              <div>
                <label htmlFor="email-body" className={FIELD_LABEL}>{t("email.body")}</label>
                <textarea
                  id="email-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t("email.body.placeholder")}
                  rows={12}
                  className={`${fieldCls} resize-y font-mono leading-relaxed`}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setAiWriteError(""); setShowAiModal(true); }}
                  className={btn("secondary")}
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M6 10l-2 2" />
                  </svg>
                  {t("email.aiWrite")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  disabled={!showPreview && (!subject.trim() || !body.trim())}
                  aria-expanded={showPreview}
                  className={btn("secondary")}
                >
                  {showPreview ? t("email.preview.hide") : t("email.preview.show")}
                </button>
              </div>

              {showPreview && previewHtml && (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--background)] flex items-center gap-2">
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
                    <span aria-hidden="true" className="w-2.5 h-2.5 rounded-full bg-[var(--border-strong)]" />
                    <span className="ml-2 text-[12px] text-[var(--foreground-subtle)]">{t("email.preview.title")}</span>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    title={t("email.preview.title")}
                    className="w-full"
                    style={{ height: 600, border: "none" }}
                  />
                </div>
              )}
            </FormSection>

            {/* Send */}
            <div className="flex flex-col gap-3 p-4 md:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="flex-[1_1_260px] text-[12px] leading-[18px] text-[var(--foreground-muted)]">
                  {t("email.send.note")}
                </p>
                <button
                  type="button"
                  onClick={() => sendEmail(true)}
                  disabled={!canSend || testSending || sending}
                  className={btn("secondary")}
                >
                  {testSending ? <>{SPINNER}{t("email.send.testing")}</> : t("email.send.test")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!canSend || testSending || sending || recipientCount === 0}
                  className={btn("primary")}
                >
                  {sending
                    ? <>{SPINNER}{t("email.send.sending")}</>
                    : recipientCount > 0
                      ? t("email.send.to", { count: recipientCount })
                      : t("email.send.toAudience")}
                </button>
              </div>

              {/* Result */}
              {sendError && (
                <div role="alert" className={bannerErr}>
                  <p className="font-medium">{t("email.send.failed")}</p>
                  <p className="text-xs mt-1 break-words">{sendError}</p>
                </div>
              )}
              {result && (
                <div role={result.ok ? "status" : "alert"} className={result.ok ? bannerOk : bannerErr}>
                  {result.ok ? (
                    <p>
                      {result.testOnly
                        ? t("email.result.test")
                        : t("email.result.sent", { count: result.total, sent: result.sent, total: result.total })}
                    </p>
                  ) : (
                    <div>
                      <p className="font-medium mb-1">
                        {result.testOnly
                          ? t("email.result.testFailed")
                          : t("email.result.partial", { count: failedBatches, sent: result.sent, total: result.total })}
                      </p>
                      {result.errors?.map((err, i) => (
                        <p key={i} className="text-xs mt-1 break-words">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </FormPanel>
        </div>
      </AdminPage>

      {/* AI Write modal */}
      {showAiModal && (
        <Modal
          onClose={() => setShowAiModal(false)}
          label={t("email.ai.title")}
          panelClassName="rounded-2xl w-full max-w-md max-h-[90dvh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <div>
              <h2 className="font-display text-lg font-light text-[var(--foreground)]">{t("email.ai.title")}</h2>
              <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5">{t("email.ai.subtitle")}</p>
            </div>
            <button
              onClick={() => setShowAiModal(false)}
              aria-label={t("common.close")}
              title={t("common.close")}
              className={`${BTN_ICON} shrink-0`}
            >
              {CLOSE_ICON}
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            {subject && (
              <div className="text-[12px] text-[var(--foreground-subtle)] px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--background)]">
                {t("email.preview.subjectLine")} <span className="text-[var(--foreground-muted)]">{subject}</span>
              </div>
            )}
            <div>
              <label htmlFor="email-ai-brief" className={FIELD_LABEL}>{t("email.ai.brief")}</label>
              <textarea
                id="email-ai-brief"
                value={aiBrief}
                onChange={(e) => setAiBrief(e.target.value)}
                placeholder={t("email.ai.briefPlaceholder")}
                rows={4}
                className={`${fieldCls} resize-none`}
                autoFocus
                disabled={aiWriting}
              />
            </div>
            {aiWriteError && <p role="alert" className="text-xs text-[var(--err)] break-words">{aiWriteError}</p>}
            {aiWriting && (
              <p role="status" className="text-xs text-[var(--foreground-muted)] animate-pulse">{t("email.ai.writing")}</p>
            )}
          </div>
          <div className="px-5 py-4 border-t border-[var(--border)] flex gap-3">
            <button
              onClick={handleAiWrite}
              disabled={(!subject.trim() && !aiBrief.trim()) || aiWriting}
              className={`${btn("primary")} flex-1`}
            >
              {aiWriting
                ? <>{SPINNER}{t("email.ai.writingShort")}</>
                : t("email.ai.generate")}
            </button>
            <button
              onClick={() => setShowAiModal(false)}
              disabled={aiWriting}
              className={btn("ghost")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}

      {/* Save template modal */}
      {showSaveModal && (
        <Modal
          onClose={() => setShowSaveModal(false)}
          label={t("email.templates.saveTemplate")}
          panelClassName="rounded-2xl w-full max-w-sm max-h-[90dvh] overflow-y-auto"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
            <h2 className="font-display text-lg font-light text-[var(--foreground)]">{t("email.templates.saveTemplate")}</h2>
            <button
              onClick={() => setShowSaveModal(false)}
              aria-label={t("common.close")}
              title={t("common.close")}
              className={BTN_ICON}
            >
              {CLOSE_ICON}
            </button>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <label htmlFor="email-template-name" className={FIELD_LABEL}>{t("email.templates.name")}</label>
              <input
                id="email-template-name"
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.repeat) handleSaveTemplate(); }}
                placeholder={t("email.templates.namePlaceholder")}
                className={fieldCls}
                autoFocus
              />
            </div>
            <div className="text-[12px] text-[var(--foreground-subtle)] space-y-0.5">
              <p><span className="text-[var(--foreground-muted)]">{t("email.preview.subjectLine")}</span> {subject}</p>
              <p><span className="text-[var(--foreground-muted)]">{t("email.preview.bodyLine")}</span> {body.slice(0, 60)}{body.length > 60 ? "…" : ""}</p>
            </div>
            {saveTemplateError && (
              <p role="alert" className="text-xs text-[var(--err)] break-words">
                {t("email.templates.saveFailed", { error: saveTemplateError })}
              </p>
            )}
          </div>
          <div className="px-5 py-4 border-t border-[var(--border)] flex gap-3">
            <button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim() || savingTemplate}
              className={`${btn("primary")} flex-1`}
            >
              {savingTemplate ? t("common.saving") : t("email.templates.saveTemplate")}
            </button>
            <button
              onClick={() => setShowSaveModal(false)}
              className={btn("ghost")}
            >
              {t("common.cancel")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
