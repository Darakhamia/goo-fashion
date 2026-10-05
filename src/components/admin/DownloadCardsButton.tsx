"use client";

import { useCallback, useRef, useState } from "react";
import { useToast } from "@/components/admin/Toast";
import { useT } from "@/app/goo-studio/_i18n";

/**
 * Downloading cards out of the studio (`useDownloadCards`): one row's card or
 * everything in the table, started from a row's "…", the page header's menu or
 * the selection bar. (The file keeps the name of the buttons it used to export;
 * GS4-4 moved those actions into the menus.)
 *
 * Both go to /api/admin/export-images, which draws the card as the site draws it
 * — photo, brand, name, price — and answers with a PNG for a single card or a
 * streamed ZIP for several. A look counts as several: it is exported with the
 * card of every piece in it, so even one look comes back as an archive.
 * Hence `saveCards` below rather than a plain link:
 * the response is a POST body that has to be read and saved by hand, and while
 * it is being read the page can show the megabytes as they land. That
 * counter is not decoration — three hundred cards take a minute or two to fetch
 * and draw, and a button that only says "Downloading…" for that long is
 * indistinguishable from one that has hung.
 */

type Kind = "products" | "outfits";

type Notify = (message: string, type: "ok" | "err") => void;

/** The caller's `onNotify`, or the admin's one toast. */
function useNotify(onNotify?: Notify): Notify {
  const toast = useToast();
  return useCallback<Notify>(
    (message, type) => {
      if (onNotify) onNotify(message, type);
      else if (type === "err") toast.err(message);
      else toast.ok(message);
    },
    [onNotify, toast],
  );
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

/** What came back: how big it was, and whether it was an archive or one picture. */
interface Saved {
  bytes: number;
  /** True when the answer was a ZIP — several cards, rather than one PNG. */
  zipped: boolean;
}

/**
 * Ask for the cards, save what comes back, and report what it was.
 *
 * Whether one card comes back as a picture or as an archive is the server's
 * call, not the caller's: a look is drawn together with the pieces it is made
 * of, so asking for one look can still be an archive of several cards. Hence
 * `zipped` in the answer — the label the caller then writes is about what
 * actually landed in the downloads folder.
 *
 * `onProgress` is called as the body arrives, for callers with room to show it.
 * Anything that went wrong is thrown with the server's own words, since it knows
 * which piece failed and why.
 */
async function saveCards(
  kind: Kind,
  ids: string[] | null,
  onProgress?: (bytes: number) => void,
): Promise<Saved> {
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

  return { bytes: blob.size, zipped: !type.startsWith("image/") };
}

/**
 * The download, started from a menu item or the selection bar. `received`
 * counts the bytes as they arrive while `busy`.
 */
export function useDownloadCards(kind: Kind, onNotify?: Notify) {
  const t = useT();
  const notify = useNotify(onNotify);
  const [busy, setBusy] = useState(false);
  const [received, setReceived] = useState(0);
  const lastTick = useRef(0);

  const download = useCallback(
    async (ids: string[] | null) => {
      if (busy) return;
      setBusy(true);
      setReceived(0);
      lastTick.current = 0;

      try {
        const { bytes, zipped } = await saveCards(kind, ids, (total) => {
          const now = Date.now();
          if (now - lastTick.current > TICK) {
            lastTick.current = now;
            setReceived(total);
          }
        });
        const mb = (bytes / MB).toFixed(1);
        notify(t(zipped ? "cards.downloadedZip" : "cards.downloadedOne", { mb }), "ok");
      } catch (e) {
        notify(e instanceof Error ? e.message : t("cards.failed"), "err");
      } finally {
        setBusy(false);
        setReceived(0);
      }
    },
    [busy, kind, notify, t],
  );

  return { busy, received, download };
}
