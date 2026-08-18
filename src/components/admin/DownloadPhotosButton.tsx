"use client";

import { useCallback, useRef, useState } from "react";

/**
 * "Download photos" for a list of admin cards, pieces or looks alike.
 *
 * The archive is built by /api/admin/export-images and streamed, so the button
 * reads the response chunk by chunk and shows the megabytes as they land. That
 * counter is the whole point of not just pointing a link at the route: an export
 * of three hundred photos takes a minute or two, and a button that only says
 * "Downloading…" for that long is indistinguishable from one that has hung.
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

function filenameFrom(header: string | null, kind: Kind): string {
  const quoted = header ? /filename="([^"]+)"/.exec(header)?.[1] : null;
  return quoted ?? `goo-${kind}-photos-${new Date().toISOString().slice(0, 10)}.zip`;
}

export function DownloadPhotosButton({ kind, ids, count, disabled, title, onNotify }: Props) {
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(0);
  const lastTick = useRef(0);

  const handleClick = useCallback(async () => {
    if (busy || !count) return;
    setBusy(true);
    setReceived(0);
    lastTick.current = 0;

    try {
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
        onNotify?.(message ?? `Export failed (${res.status}).`, "err");
        return;
      }

      // Read the stream so the counter can move. Without a body reader there is
      // nothing to count, so fall back to the blob and a silent wait.
      let blob: Blob;
      if (res.body) {
        const reader = res.body.getReader();
        const chunks: BlobPart[] = [];
        let total = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value as BlobPart);
          total += value.byteLength;
          const now = Date.now();
          if (now - lastTick.current > TICK) {
            lastTick.current = now;
            setReceived(total);
          }
        }
        blob = new Blob(chunks, { type: "application/zip" });
      } else {
        blob = await res.blob();
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filenameFrom(res.headers.get("Content-Disposition"), kind);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      onNotify?.(
        `Photos downloaded (${(blob.size / MB).toFixed(1)} MB). See _export.txt inside for anything that failed.`,
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
      ? `Download photos (${count})`
      : "Download photos";

  return (
    <button
      onClick={handleClick}
      disabled={disabled || busy || !count}
      aria-busy={busy}
      title={
        title ??
        (ids
          ? `Download the card photos of the ${count} selected`
          : "Download the card photo of every card here, as one ZIP")
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
