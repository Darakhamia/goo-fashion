"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Downloading cards out of the studio: one piece from its row, or everything in
 * the table from the toolbar.
 *
 * Both go to /api/admin/export-images, which draws the card as the site draws it
 * — photo, brand, name, price — and answers with a PNG for a single card or a
 * streamed ZIP for several. Hence `saveCards` below rather than a plain link:
 * the response is a POST body that has to be read and saved by hand, and while
 * it is being read the toolbar button can show the megabytes as they land. That
 * counter is not decoration — three hundred cards take a minute or two to fetch
 * and draw, and a button that only says "Downloading…" for that long is
 * indistinguishable from one that has hung.
 */

type Kind = "products" | "outfits";

interface Props {
  kind: Kind;
  /**
   * Which cards to export: `null` asks the server for every card of this kind,
   * a list asks for exactly those. Passing null rather than "all the ids I have
   * on screen" keeps a full-catalogue export a short request.
   */
  ids: string[] | null;
  /** How many cards this click will fetch, for the label. */
  count: number;
  disabled?: boolean;
  title?: string;
  onNotify?: (message: string, type: "ok" | "err") => void;
}

const MB = 1024 * 1024;

/** How often the byte counter is allowed to re-render, in ms. */
const TICK = 200;

/**
 * The name the server gave the file.
 *
 * `filename*` is read first and decoded: it is the one that carries a piece
 * named in Cyrillic, where the plain `filename` beside it is the ASCII
 * placeholder the header is allowed to hold.
 */
function filenameFrom(header: string | null, fallback: string): string {
  if (header) {
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)?.[1];
    if (encoded) {
      try {
        return decodeURIComponent(encoded);
      } catch {
        /* fall through to the plain one */
      }
    }
    const quoted = /filename="([^"]+)"/.exec(header)?.[1];
    if (quoted) return quoted;
  }
  return fallback;
}

/**
 * Ask for the cards, save what comes back, and report its size.
 *
 * `onProgress` is called as the body arrives, for callers with room to show it.
 * Anything that went wrong is thrown with the server's own words, since it knows
 * which piece failed and why.
 */
async function saveCards(
  kind: Kind,
  ids: string[] | null,
  onProgress?: (bytes: number) => void,
): Promise<number> {
  const res = await fetch("/api/admin/export-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, ...(ids ? { ids } : {}) }),
  });

  if (!res.ok) {
    const message = await res
      .json()
      .then((j: { error?: string }) => j.error)
      .catch(() => null);
    throw new Error(message ?? `Export failed (${res.status}).`);
  }

  const type = res.headers.get("Content-Type") ?? "application/octet-stream";
  // Read the stream so the counter can move. Without a body reader there is
  // nothing to count, so fall back to the blob and a silent wait.
  let blob: Blob;
  if (res.body && onProgress) {
    const reader = res.body.getReader();
    const chunks: BlobPart[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value as BlobPart);
      total += value.byteLength;
      onProgress(total);
    }
    blob = new Blob(chunks, { type });
  } else {
    blob = await res.blob();
  }

  const today = new Date().toISOString().slice(0, 10);
  const fallback = type.startsWith("image/")
    ? `goo-card-${today}.png`
    : `goo-${kind === "products" ? "product" : "look"}-cards-${today}.zip`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filenameFrom(res.headers.get("Content-Disposition"), fallback);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  return blob.size;
}

export function DownloadCardsButton({ kind, ids, count, disabled, title, onNotify }: Props) {
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(0);
  const lastTick = useRef(0);

  const handleClick = useCallback(async () => {
    if (busy || !count) return;
    setBusy(true);
    setReceived(0);
    lastTick.current = 0;

    try {
      const size = await saveCards(kind, ids, (total) => {
        const now = Date.now();
        if (now - lastTick.current > TICK) {
          lastTick.current = now;
          setReceived(total);
        }
      });
      onNotify?.(
        count === 1
          ? `Card downloaded (${(size / MB).toFixed(1)} MB).`
          : `Cards downloaded (${(size / MB).toFixed(1)} MB). See _export.txt inside for anything that failed.`,
        "ok",
      );
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : "Export failed.", "err");
    } finally {
      setBusy(false);
      setReceived(0);
    }
  }, [busy, count, ids, kind, onNotify]);

  const label = busy
    ? received
      ? `Packing… ${(received / MB).toFixed(1)} MB`
      : "Packing…"
    : ids
      ? `Download cards (${count})`
      : "Download cards";

  return (
    <button
      onClick={handleClick}
      disabled={disabled || busy || !count}
      aria-busy={busy}
      title={
        title ??
        (ids
          ? `Download the ${count} selected cards as pictures`
          : "Download every card here as a picture, in one ZIP")
      }
      className="inline-flex items-center gap-1.5 border border-[var(--border)] rounded-lg px-3 py-2 text-xs tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path
          d="M6 1v6.5M3.5 5L6 7.5 8.5 5M1.5 8.5v1.2a.8.8 0 00.8.8h7.4a.8.8 0 00.8-.8V8.5"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {label}
    </button>
  );
}

interface RowProps {
  kind: Kind;
  /** The one card to draw. */
  id: string;
  onNotify?: (message: string, type: "ok" | "err") => void;
}

/**
 * The same download, for one row of the table: a card as a PNG, in one click.
 *
 * It sits among the row's other icons, so it is an icon too — the work it starts
 * is reported through the page's own toast rather than in a label, and the arrow
 * dims while the card is being drawn.
 */
export function DownloadCardButton({ kind, id, onNotify }: RowProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveCards(kind, [id]);
      onNotify?.("Card downloaded.", "ok");
    } catch (e) {
      onNotify?.(e instanceof Error ? e.message : "Could not draw the card.", "err");
    } finally {
      setBusy(false);
    }
  }, [busy, id, kind, onNotify]);

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      aria-busy={busy}
      aria-label="Download card"
      title="Download this card as a PNG — photo, brand, name and price"
      className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors p-1 disabled:opacity-40 disabled:cursor-wait"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path
          d="M7 1.5v7M4.2 5.8L7 8.6l2.8-2.8M2 10v1.5a1 1 0 001 1h8a1 1 0 001-1V10"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
