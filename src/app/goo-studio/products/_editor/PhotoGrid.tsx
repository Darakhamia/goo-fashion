"use client";

import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { Badge } from "@/components/admin/Badge";
import { RowMenu } from "@/components/admin/Menu";
import { btn, INPUT } from "@/app/goo-studio/_ui/recipes";
import { useT } from "@/app/goo-studio/_i18n";
import { pastedUrl } from "@/lib/url";
import { EXAMPLE } from "./form";

/*
 * The product's photos (GS6-1, ADMIN_DESIGN «Товар»): a grid, four to a row,
 * the first one the main photo. Drag a photo to reorder; the "…" on a photo
 * does the same from the keyboard (make main, move, remove). New photos come
 * from a file or a link, and both end up in our storage: a link is copied in
 * so the product does not hotlink a store's CDN, and when the copy fails the
 * photo stays with the link and a note saying why.
 */

type Update = (update: (imgs: string[]) => string[]) => void;

const move = (list: string[], from: number, to: number) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export function PhotoGrid({ images, onChange, disabled = false }: { images: string[]; onChange: Update; disabled?: boolean }) {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const [link, setLink] = useState("");
  /** Uploads in flight, shown as tiles with a spinner. */
  const [pending, setPending] = useState(0);
  /** Why a photo is still on someone else's CDN, by its URL. */
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const upload = async (body: FormData | string): Promise<{ url?: string; error?: string }> => {
    const res = await fetch("/api/admin/upload-image", {
      method: "POST",
      ...(typeof body === "string"
        ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: body }) }
        : { body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) return { error: data.error || t("products.image.uploadFailedHttp", { status: String(res.status) }) };
    return { url: data.url as string };
  };

  const addFiles = async (files: FileList | null) => {
    const list = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!list.length || disabled) return;
    setFailed(null);
    setPending((n) => n + list.length);
    for (const file of list) {
      const form = new FormData();
      form.append("file", file);
      try {
        const { url, error } = await upload(form);
        if (url) onChange((imgs) => [...imgs, url]);
        else setFailed(t("products.photos.fileFailed", { name: file.name, error: error ?? "" }));
      } catch {
        setFailed(t("products.photos.fileFailed", { name: file.name, error: t("common.networkError") }));
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const addLink = async () => {
    const url = pastedUrl(link);
    if (!url || disabled) return;
    setLink("");
    setFailed(null);
    if (images.includes(url)) return;
    setPending((n) => n + 1);
    try {
      const { url: stored, error } = await upload(url);
      if (stored) onChange((imgs) => (imgs.includes(stored) ? imgs : [...imgs, stored]));
      else {
        // Kept with the link: a photo on the store's CDN beats no photo, and
        // the note says it is not ours yet.
        onChange((imgs) => [...imgs, url]);
        setNotes((n) => ({ ...n, [url]: error ?? t("products.image.uploadFailed") }));
      }
    } catch {
      onChange((imgs) => [...imgs, url]);
      setNotes((n) => ({ ...n, [url]: t("common.networkError") }));
    } finally {
      setPending((n) => n - 1);
    }
  };

  const onDrop = (to: number) => (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) {
      void addFiles(e.dataTransfer.files);
    } else if (dragFrom !== null && dragFrom !== to) {
      onChange((imgs) => move(imgs, dragFrom, to));
    }
    setDragFrom(null);
    setDragOver(null);
  };

  const noted = images.filter((u) => notes[u]);

  return (
    <div className="flex flex-col gap-3">
      <ul aria-label={t("products.photos.title")} className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {images.map((url, i) => (
          <li
            key={url}
            draggable={!disabled}
            onDragStart={(e) => {
              setDragFrom(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragEnd={() => {
              setDragFrom(null);
              setDragOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(i);
            }}
            onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
            onDrop={onDrop(i)}
            className={`group relative aspect-[3/4] rounded-lg overflow-hidden border bg-[var(--background)] transition-[opacity,border-color] ${
              dragOver === i && dragFrom !== i ? "border-[var(--foreground)]" : "border-[var(--border)]"
            } ${dragFrom === i ? "opacity-40" : ""} ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={i === 0 ? t("products.photos.mainAlt") : t("products.photos.alt", { n: i + 1 })}
              draggable={false}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = "0.3"; }}
            />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5">
                <Badge tone="inverse">{t("products.image.main")}</Badge>
              </span>
            )}
            {notes[url] && (
              <span className="absolute bottom-1.5 left-1.5">
                <Badge tone="warn" title={notes[url]}>{t("products.photos.external")}</Badge>
              </span>
            )}
            {!disabled && (
              <span className="absolute top-1 right-1 rounded-lg bg-[var(--surface)] shadow-[0_1px_3px_rgba(0,0,0,0.12)] md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <RowMenu
                  size="sm"
                  label={t("products.photos.menu", { n: i + 1 })}
                  items={[
                    ...(i > 0 ? [{ label: t("products.photos.makeMain"), onSelect: () => onChange((imgs) => move(imgs, i, 0)) }] : []),
                    ...(i > 0 ? [{ label: t("products.photos.moveLeft"), onSelect: () => onChange((imgs) => move(imgs, i, i - 1)) }] : []),
                    ...(i < images.length - 1 ? [{ label: t("products.photos.moveRight"), onSelect: () => onChange((imgs) => move(imgs, i, i + 1)) }] : []),
                    { label: t("products.photos.remove"), tone: "danger" as const, onSelect: () => onChange((imgs) => imgs.filter((u) => u !== url)) },
                  ]}
                />
              </span>
            )}
          </li>
        ))}
        {Array.from({ length: pending }, (_, i) => (
          <li key={`pending-${i}`} className="aspect-[3/4] rounded-lg border border-[var(--border)] bg-[var(--background)] flex items-center justify-center">
            <span role="status" aria-label={t("products.photos.uploading")} className="w-4 h-4 border border-[var(--foreground-muted)] border-t-transparent rounded-full animate-spin" />
          </li>
        ))}
        {!disabled && (
          <li>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop(images.length)}
              className="w-full aspect-[3/4] rounded-lg border border-dashed border-[var(--border-strong)] flex flex-col items-center justify-center gap-1.5 px-2 text-center text-[12px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--foreground-muted)] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 11V3M4.5 6.5L8 3l3.5 3.5M3 13h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t("products.photos.upload")}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
              multiple
              hidden
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </li>
        )}
      </ul>

      {!disabled && (
        <div className="flex gap-2">
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addLink();
              }
            }}
            placeholder={EXAMPLE.url}
            aria-label={t("products.photos.addLink")}
            className={`${INPUT} flex-1 min-w-0`}
          />
          <button type="button" onClick={() => void addLink()} disabled={!link.trim()} className={btn("secondary")}>
            {t("products.photos.addLinkButton")}
          </button>
        </div>
      )}

      {failed && <p role="alert" className="text-[12px] text-[var(--err)]">{failed}</p>}
      {noted.map((u) => (
        <p key={u} className="text-[12px] leading-snug text-[var(--warn)] break-words">
          {t("products.image.notCopied", { error: notes[u] })}
        </p>
      ))}
      {images.length === 0 && pending === 0 && (
        <p className="text-[12px] text-[var(--foreground-subtle)]">{t("products.photos.none")}</p>
      )}
    </div>
  );
}
