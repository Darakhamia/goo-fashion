"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useLikes } from "@/lib/context/likes-context";
import { useCurrency } from "@/lib/context/currency-context";
import { products as staticProducts } from "@/lib/data/products";
import type { Outfit, Product } from "@/lib/types";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";

type View = "outfits" | "pieces" | "looks";

// ── Saved builder outfit type ─────────────────────────────────────────────────
interface SavedLook {
  id: string;
  savedAt: string;
  name?: string;
  description?: string;
  pieces: { slot: string; productId: string; variantId?: string | null; imageUrl?: string; name?: string }[];
  totalPrice: number;
  styleKeywords: string[];
  generatedImage?: string | null;
  generatedStyle?: "mannequin" | "flatlay" | "tryon";
}

const SLOT_ORDER = ["outerwear", "top", "bottom", "shoes", "accessories", "accessories2"];

// ── Builder outfit card ───────────────────────────────────────────────────────
function LookCard({ look, onDelete, onRename, allProducts }: { look: SavedLook; onDelete: () => void; onRename: (id: string, name: string) => void; allProducts: Product[] }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { formatPrice } = useCurrency();
  const [shareState, setShareState] = useState<"idle" | "submitting" | "done">("idle");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(look.name || "My Look");

  const commitName = () => {
    const trimmed = nameValue.trim() || "My Look";
    setNameValue(trimmed);
    setEditingName(false);
    if (trimmed !== (look.name || "My Look")) onRename(look.id, trimmed);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (shareState !== "idle") return;
    setShareState("submitting");
    try {
      await fetch("/api/looks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generatedImage: look.generatedImage,
          generatedStyle: look.generatedStyle,
          pieces: look.pieces,
          totalPrice: look.totalPrice,
          styleKeywords: look.styleKeywords,
        }),
      });
      setShareState("done");
    } catch {
      setShareState("idle");
    }
  };

  // Priority order for display layout
  const SLOT_PRIORITY: Record<string, number> = {
    outerwear: 0, top: 1, bottom: 2, shoes: 3, accessories: 4, accessories2: 5,
  };

  const pieces = [...look.pieces]
    .sort((a, b) => (SLOT_PRIORITY[a.slot] ?? 99) - (SLOT_PRIORITY[b.slot] ?? 99))
    .map((piece) => {
      const product = allProducts.find((p) => p.id === piece.productId);
      return {
        slot: piece.slot,
        imageUrl: piece.imageUrl ?? product?.imageUrl ?? null,
        name: piece.name ?? product?.name ?? piece.slot,
        productId: piece.productId,
      };
    });

  const builderUrl =
    "/builder?editId=" + look.id + "&" +
    look.pieces
      .flatMap((p) => {
        const params = [`${p.slot}=${p.productId}`];
        if (p.variantId) params.push(`${p.slot}_variant=${p.variantId}`);
        return params;
      })
      .join("&");

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(true);
  };

  return (
    <>
      <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Main image — click opens detail modal */}
        <button onClick={() => setOpen(true)} className="img-zoom block w-full text-left relative overflow-hidden aspect-[3/4]">
          {look.generatedImage ? (
            <div className="absolute inset-0 overflow-hidden bg-[var(--surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={look.generatedImage}
                alt="Generated look"
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2.5 left-2.5 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-0.5 backdrop-blur-sm">
                {look.generatedStyle === "flatlay" ? "Flat lay" : look.generatedStyle === "tryon" ? "On You" : "AI"}
              </span>
            </div>
          ) : pieces.length > 0 ? (
            /* Collage grid — same layout as OutfitCollage and builder preview */
            <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
              {(() => {
                const frames = pieces.slice(0, 6);
                const n = frames.length;

                const cell = (piece: typeof pieces[0], key: string, pad = "p-2") => (
                  <div key={key} className="relative overflow-hidden flex-1 bg-white">
                    {piece.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={piece.imageUrl} alt={piece.name ?? ""} className={`absolute inset-0 w-full h-full object-contain ${pad}`} />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center bg-[#f0f0f0]">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="opacity-30">
                          <rect x="3" y="3" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    )}
                  </div>
                );

                if (n === 1) return (
                  <div className="absolute inset-0 flex">{cell(frames[0], "f0", "p-3")}</div>
                );

                if (n === 2) return (
                  <div className="absolute inset-0 flex gap-px bg-gray-200">
                    {frames.map((f, i) => cell(f, `f${i}`))}
                  </div>
                );

                if (n === 3) return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 60%" }}>
                      {frames.slice(0, 2).map((f, i) => cell(f, `f${i}`))}
                    </div>
                    <div className="relative overflow-hidden flex-1 bg-white">
                      {frames[2].imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={frames[2].imageUrl} alt={frames[2].name ?? ""} className="absolute inset-0 w-full h-full object-contain p-2" />
                      )}
                    </div>
                  </div>
                );

                if (n === 4) return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px flex-1 bg-gray-200">
                      {frames.slice(0, 2).map((f, i) => cell(f, `f${i}`))}
                    </div>
                    <div className="flex gap-px flex-1 bg-gray-200">
                      {frames.slice(2, 4).map((f, i) => cell(f, `f${i + 2}`))}
                    </div>
                  </div>
                );

                if (n === 5) return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 57%" }}>
                      {frames.slice(0, 2).map((f, i) => cell(f, `f${i}`))}
                    </div>
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 43%" }}>
                      {frames.slice(2, 5).map((f, i) => cell(f, `f${i + 2}`, "p-1.5"))}
                    </div>
                  </div>
                );

                // 6 pieces
                return (
                  <div className="absolute inset-0 flex flex-col gap-px bg-gray-200">
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 40%" }}>
                      {frames.slice(0, 2).map((f, i) => cell(f, `f${i}`))}
                    </div>
                    <div className="flex gap-px bg-gray-200" style={{ flex: "0 0 33%" }}>
                      {frames.slice(2, 5).map((f, i) => cell(f, `f${i + 2}`, "p-1.5"))}
                    </div>
                    <div className="relative overflow-hidden bg-white" style={{ flex: "0 0 27%" }}>
                      {frames[5].imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={frames[5].imageUrl} alt={frames[5].name ?? ""} className="absolute inset-0 w-full h-full object-contain p-1.5" />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* No pieces yet */
            <div className="absolute inset-0 bg-[var(--surface)] flex flex-col items-center justify-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-20">
                <rect x="3" y="3" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-[9px] uppercase text-[var(--foreground-subtle)] opacity-50">Empty look</span>
            </div>
          )}
          <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
        </button>

        {/* Delete button */}
        <button
          onClick={handleDelete}
          title="Delete look"
          className="absolute top-3 right-3 z-20 w-8 h-8 flex items-center justify-center bg-[var(--bg-overlay-90)] backdrop-blur-sm rounded-full transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>

        {/* Info */}
        <div className="px-5 pt-4 pb-5">
          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitName(); } if (e.key === "Escape") { setNameValue(look.name || "My Look"); setEditingName(false); } }}
              className="w-full text-[15px] font-semibold bg-transparent outline-none border-b border-[var(--foreground)] pb-0.5 text-[var(--foreground)] leading-snug"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setNameValue(look.name || "My Look"); setEditingName(true); }}
              className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug w-full text-left hover:opacity-70 transition-opacity"
              title="Click to rename"
            >
              {look.name || "My Look"}
            </button>
          )}
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[13px] text-[var(--foreground-muted)] truncate flex-1 min-w-0">
              {formatPrice(look.totalPrice)}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href={builderUrl}
                className="text-[11px] tracking-[0.1em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={look.generatedImage ? handleShare : undefined}
                disabled={!look.generatedImage || shareState !== "idle"}
                title={shareState === "done" ? "Submitted for review" : "Share this look"}
                className={`text-[11px] tracking-[0.1em] uppercase font-medium transition-colors disabled:cursor-default ${
                  !look.generatedImage
                    ? "text-[var(--foreground-subtle)] opacity-30"
                    : shareState === "done"
                    ? "text-green-500"
                    : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {shareState === "done" ? "Sent" : shareState === "submitting" ? "…" : "Share"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete confirmation modal ── */}
      <AnimatePresence>
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmDelete(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="bg-[var(--background)] border border-[var(--border)] rounded-2xl p-6 max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-[var(--foreground)] mb-1">Delete this look?</p>
            <p className="text-[11px] text-[var(--foreground-subtle)] mb-5">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { onDelete(); setConfirmDelete(false); }}
                className="flex-1 h-9 text-[11px] tracking-[0.1em] uppercase font-medium rounded-xl bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 h-9 text-[11px] tracking-[0.1em] uppercase font-medium rounded-xl border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
              >
                No
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* ── Look preview modal ── */}
      <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`bg-[var(--background)] w-full overflow-hidden flex flex-col rounded-2xl max-w-3xl`}
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex-1 min-w-0 mr-4">
                <input
                  type="text"
                  value={nameValue}
                  onChange={e => setNameValue(e.target.value)}
                  onBlur={commitName}
                  onKeyDown={e => {
                    if (e.key === "Enter") { e.preventDefault(); commitName(); }
                    if (e.key === "Escape") { setNameValue(look.name || "My Look"); }
                  }}
                  className="w-full text-[17px] font-bold bg-transparent outline-none border-b border-transparent hover:border-[var(--border)] focus:border-[var(--foreground)] transition-colors pb-0.5 text-[var(--foreground)] leading-snug"
                  placeholder="Name your look…"
                />
                <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-1">
                  {formatPrice(look.totalPrice)}{look.styleKeywords.length > 0 ? " · " + look.styleKeywords.slice(0, 3).join(" · ") : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={builderUrl}
                  onClick={() => setOpen(false)}
                  className="text-[9px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
                >
                  Edit in Builder →
                </Link>
                {look.generatedImage && (
                  shareState === "done" ? (
                    <span className="text-[9px] tracking-[0.12em] uppercase font-medium text-green-500">
                      Under review ✓
                    </span>
                  ) : (
                    <button
                      onClick={handleShare}
                      disabled={shareState === "submitting"}
                      className="text-[9px] tracking-[0.12em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-40"
                    >
                      {shareState === "submitting" ? "Sharing…" : "Share"}
                    </button>
                  )
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Body */}
            {look.generatedImage ? (
              /* ── Side-by-side: AI image left, pieces list right ── */
              <div className="flex min-h-0 flex-1">
                {/* Left: generated image */}
                <div className="relative w-[56%] shrink-0 border-r border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={look.generatedImage}
                    alt="Generated look"
                    className="w-full h-full object-cover object-top"
                  />
                  <a
                    href={look.generatedImage}
                    download="goo-outfit.jpg"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-3 right-3 font-mono text-[9px] tracking-[0.12em] uppercase bg-[var(--background)]/85 backdrop-blur-sm text-[var(--foreground)] px-2.5 py-1.5 hover:bg-[var(--background)] transition-colors"
                  >
                    Download
                  </a>
                  {look.generatedStyle && (
                    <span className="absolute top-3 left-3 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-1 backdrop-blur-sm">
                      {look.generatedStyle === "flatlay" ? "Flat lay" : look.generatedStyle === "tryon" ? "On You" : "AI"}
                    </span>
                  )}
                </div>

                {/* Right: pieces list */}
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {pieces.length > 0 ? pieces.map(({ slot, imageUrl, name, productId }) => (
                    <Link
                      key={slot}
                      href={`/product/${productId}`}
                      onClick={() => setOpen(false)}
                      className="group/item flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface)] transition-colors"
                    >
                      <div className="w-14 h-14 shrink-0 bg-[var(--surface)] overflow-hidden rounded-lg border border-[var(--border)]">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-contain p-1 group-hover/item:scale-105 transition-transform duration-200"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-mono text-[8px] text-[var(--border-strong)]">{slot[0].toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[8px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] mb-0.5 capitalize">{slot}</p>
                        <p className="text-xs text-[var(--foreground)] truncate">{name}</p>
                      </div>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--foreground-subtle)] group-hover/item:text-[var(--foreground)] transition-colors">
                        <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  )) : (
                    <div className="flex items-center justify-center h-full py-12">
                      <p className="font-mono text-[9px] uppercase text-[var(--foreground-subtle)]">No pieces</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── No generated image: collage left, pieces list right (same layout as generated) ── */
              <div className="flex min-h-0 flex-1">
                {/* Left: piece collage */}
                <div className="relative w-[56%] shrink-0 border-r border-[var(--border)] overflow-hidden bg-gray-200 flex flex-col gap-px">
                  {(() => {
                    const n = pieces.length;
                    const cell = (piece: typeof pieces[0], pad = "p-3") => (
                      <div key={piece.slot} className="flex-1 overflow-hidden bg-white min-w-0 min-h-0">
                        {piece.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={piece.imageUrl} alt={piece.name} className={`w-full h-full object-contain ${pad}`} />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-mono text-[8px] uppercase text-[var(--border-strong)] capitalize">{piece.slot}</span>
                          </div>
                        )}
                      </div>
                    );
                    if (n === 0) return <div className="flex-1 flex items-center justify-center"><p className="font-mono text-[9px] uppercase text-gray-400">No pieces</p></div>;
                    if (n === 1) return <div className="flex-1 flex">{cell(pieces[0], "p-6")}</div>;
                    if (n === 2) return <div className="flex-1 flex gap-px">{pieces.slice(0, 2).map(p => cell(p))}</div>;
                    if (n === 3) return (
                      <div className="flex-1 flex flex-col gap-px">
                        <div className="flex gap-px" style={{ flex: "0 0 60%" }}>{pieces.slice(0, 2).map(p => cell(p))}</div>
                        <div className="flex" style={{ flex: "0 0 40%" }}>{cell(pieces[2], "p-2")}</div>
                      </div>
                    );
                    if (n === 4) return (
                      <div className="flex-1 flex flex-col gap-px">
                        <div className="flex gap-px flex-1">{pieces.slice(0, 2).map(p => cell(p))}</div>
                        <div className="flex gap-px flex-1">{pieces.slice(2, 4).map(p => cell(p))}</div>
                      </div>
                    );
                    if (n === 5) return (
                      <div className="flex-1 flex flex-col gap-px">
                        <div className="flex gap-px" style={{ flex: "0 0 57%" }}>{pieces.slice(0, 2).map(p => cell(p))}</div>
                        <div className="flex gap-px" style={{ flex: "0 0 43%" }}>{pieces.slice(2, 5).map(p => cell(p, "p-2"))}</div>
                      </div>
                    );
                    return (
                      <div className="flex-1 flex flex-col gap-px">
                        <div className="flex gap-px" style={{ flex: "0 0 40%" }}>{pieces.slice(0, 2).map(p => cell(p))}</div>
                        <div className="flex gap-px" style={{ flex: "0 0 33%" }}>{pieces.slice(2, 5).map(p => cell(p, "p-2"))}</div>
                        <div className="flex" style={{ flex: "0 0 27%" }}>{cell(pieces[5], "p-2")}</div>
                      </div>
                    );
                  })()}
                </div>

                {/* Right: pieces list */}
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {pieces.length > 0 ? pieces.map(({ slot, imageUrl, name, productId }) => (
                    <Link
                      key={slot}
                      href={`/product/${productId}`}
                      onClick={() => setOpen(false)}
                      className="group/item flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface)] transition-colors"
                    >
                      <div className="w-14 h-14 shrink-0 bg-[var(--surface)] overflow-hidden rounded-lg border border-[var(--border)]">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={imageUrl} alt={name} className="w-full h-full object-contain p-1 group-hover/item:scale-105 transition-transform duration-200" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-mono text-[8px] text-[var(--border-strong)]">{slot[0].toUpperCase()}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[8px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] mb-0.5 capitalize">{slot}</p>
                        <p className="text-xs text-[var(--foreground)] truncate">{name}</p>
                      </div>
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className="shrink-0 text-[var(--foreground-subtle)] group-hover/item:text-[var(--foreground)] transition-colors">
                        <path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  )) : (
                    <div className="flex items-center justify-center h-full py-12">
                      <p className="font-mono text-[9px] uppercase text-[var(--foreground-subtle)]">No pieces</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const [view, setView] = useState<View>("looks");
  const { likedOutfits, likedProducts } = useLikes();
  const { formatPrice } = useCurrency();
  const { user, isLoaded } = useUser();
  const [myLooks, setMyLooks] = useState<SavedLook[]>([]);
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [allProducts, setAllProducts] = useState(staticProducts);

  // Load saved looks — from API when logged in, else from localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("tab") === "looks") setView("looks");
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    // Always load from localStorage immediately (has the latest names)
    try {
      const raw = localStorage.getItem("goo-saved-outfits");
      if (raw) setMyLooks(JSON.parse(raw));
    } catch {}

    if (user) {
      fetch("/api/user/looks")
        .then((r) => r.json())
        .then((apiLooks: SavedLook[]) => {
          if (!Array.isArray(apiLooks)) return;
          try {
            const raw = localStorage.getItem("goo-saved-outfits");
            const local: SavedLook[] = raw ? JSON.parse(raw) : [];
            const localById = new Map(local.map((l) => [l.id, l]));
            const apiIds = new Set(apiLooks.map((a) => a.id));
            // Merge API looks (prefer local name/description) + any local-only looks
            // that haven't synced to Supabase yet
            const merged = [
              ...apiLooks.map((a) => ({
                ...a,
                name: a.name ?? localById.get(a.id)?.name,
                description: a.description ?? localById.get(a.id)?.description,
              })),
              ...local.filter((l) => !apiIds.has(l.id)),
            ].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
            setMyLooks(merged);
          } catch {
            setMyLooks(apiLooks);
          }
        })
        .catch(() => {});
    }
  }, [isLoaded, user]);

  // Fetch outfits from API (includes DB outfits)
  useEffect(() => {
    fetch("/api/outfits")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAllOutfits(d); })
      .catch(() => {});
  }, []);

  // Fetch full product list from API (includes Supabase products with UUID IDs)
  useEffect(() => {
    fetch("/api/products?raw=true")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setAllProducts(d); })
      .catch(() => {});
  }, []);

  const deleteLook = (id: string) => {
    setMyLooks((prev) => {
      const next = prev.filter((l) => l.id !== id);
      try { localStorage.setItem("goo-saved-outfits", JSON.stringify(next)); } catch {}
      if (user) {
        fetch(`/api/user/looks?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
      }
      return next;
    });
  };

  const renameLook = (id: string, name: string) => {
    setMyLooks((prev) => {
      const next = prev.map((l) => l.id === id ? { ...l, name } : l);
      try { localStorage.setItem("goo-saved-outfits", JSON.stringify(next)); } catch {}
      if (user) {
        const look = next.find((l) => l.id === id);
        if (look) fetch("/api/user/looks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(look) }).catch(() => {});
      }
      return next;
    });
  };

  const savedOutfits = allOutfits.filter((o) => likedOutfits.includes(o.id));
  const savedProducts = allProducts.filter((p) => likedProducts.includes(p.id));

  const tabs: { id: View; label: string; count: number }[] = [
    { id: "looks", label: "My Looks", count: myLooks.length },
    { id: "pieces", label: "Pieces", count: likedProducts.length },
    { id: "outfits", label: "Outfits", count: likedOutfits.length },
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 mb-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Saved
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)]">
            Your Likes
          </h1>
        </div>

        {/* Toggle */}
        <div className="flex gap-0 mb-10 w-fit bg-[var(--surface)] rounded-full p-1 border border-[var(--border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="relative px-5 py-2 text-xs tracking-[0.12em] uppercase font-medium rounded-full z-10 transition-colors duration-200"
              style={{ color: view === t.id ? "var(--background)" : "var(--foreground-muted)" }}
            >
              {view === t.id && (
                <motion.div
                  layoutId="saved-tab-pill"
                  className="absolute inset-0 rounded-full bg-[var(--foreground)]"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                  style={{ zIndex: -1 }}
                />
              )}
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >

        {/* ── Outfits (liked) ── */}
        {view === "outfits" && (
          savedOutfits.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {savedOutfits.map((outfit) => (
                <motion.div
                  key={outfit.id}
                  className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                >
                  <OutfitCard outfit={outfit} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <p className="text-2xl font-bold text-[var(--foreground)] mb-3">
                No saved outfits yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any outfit to save it here.
              </p>
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity duration-200 inline-block"
              >
                Browse Outfits
              </Link>
            </div>
          )
        )}

        {/* ── Pieces (liked) ── */}
        {view === "pieces" && (
          savedProducts.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {savedProducts.map((product) => (
                <motion.div
                  key={product.id}
                  className="rounded-xl bg-[var(--background)] hover:shadow-md transition-all duration-200"
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                >
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <p className="text-2xl font-bold text-[var(--foreground)] mb-3">
                No saved pieces yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any item to save it here.
              </p>
              <Link
                href="/browse?view=pieces"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity duration-200 inline-block"
              >
                Browse Pieces
              </Link>
            </div>
          )
        )}

        {/* ── My Looks (builder-created) ── */}
        {view === "looks" && (
          myLooks.length > 0 ? (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
              initial="hidden"
              animate="show"
            >
              {myLooks.map((look) => (
                <motion.div
                  key={look.id}
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                >
                  <LookCard look={look} onDelete={() => deleteLook(look.id)} onRename={renameLook} allProducts={allProducts} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="py-20 px-8 text-center bg-[var(--surface)] rounded-2xl border border-[var(--border)]">
              <p className="text-2xl font-bold text-[var(--foreground)] mb-3">
                No looks built yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Use the Builder to assemble outfits — hit Save and they appear here.
              </p>
              <Link
                href="/builder"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-3.5 rounded-xl hover:opacity-90 transition-opacity duration-200 inline-block"
              >
                Open Builder
              </Link>
            </div>
          )
        )}

        </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
