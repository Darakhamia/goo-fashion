"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** The URL is browser state, not React state — read it as an external store so
 *  the server renders "" and the client swaps in the real value without a
 *  hydration mismatch and without a setState inside an effect. */
const noopSubscribe = () => () => {};
const readHref = () => window.location.href;
const noHref = () => "";

/**
 * Share controls for an article.
 *
 * Plain links, no third-party SDKs — the site loads no social scripts and this
 * is not the place to start. The canonical URL is read from the browser rather
 * than passed in, so it stays correct whatever host the page is served from.
 */
export default function ShareRow({ title }: { title: string }) {
  // Empty until mounted, so the buttons render disabled rather than pointing at
  // the wrong page.
  const url = useSyncExternalStore(noopSubscribe, readHref, noHref);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard is blocked in some contexts; the two share links still work.
    }
  };

  const enc = encodeURIComponent;
  // Phones: soft 40px pills in sentence case, `after:` stretching each to 44px.
  const linkCls =
    "relative h-9 px-4 rounded-full border border-[var(--border)] flex items-center justify-center text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors duration-200 max-md:h-10 max-md:min-w-11 max-md:border-0 max-md:bg-[var(--fg-overlay-08)] max-md:text-[14px] max-md:tracking-normal max-md:normal-case max-md:font-normal max-md:text-[var(--foreground)] max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-0.5";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Phones: the label sits on its own line above the pills. */}
      <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mr-2 max-md:w-full max-md:mr-0 max-md:mb-0.5 max-md:text-[13px] max-md:tracking-normal max-md:normal-case max-md:font-normal max-md:text-[var(--foreground-muted)]">
        Share
      </span>

      <button type="button" onClick={copy} disabled={!url} className={`${linkCls} disabled:opacity-40`}>
        {copied ? "Link copied" : "Copy link"}
      </button>

      {url && (
        <>
          <a
            href={`https://x.com/intent/tweet?text=${enc(title)}&url=${enc(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            X
          </a>
          <a
            href={`https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkCls}
          >
            Telegram
          </a>
        </>
      )}
    </div>
  );
}
