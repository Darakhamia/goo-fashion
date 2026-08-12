"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useLikes } from "@/lib/context/likes-context";
import { useCurrency } from "@/lib/context/currency-context";
import { useCart } from "@/lib/context/cart-context";
import { products as staticProducts } from "@/lib/data/products";
import type { Outfit, Product } from "@/lib/types";
import { isProductAvailable } from "@/lib/availability";
import ProductCard from "@/components/product/ProductCard";
import {
  loadLocalLooks,
  saveLocalLooks,
  pushLook,
  deleteLookFromServer,
  syncLooks,
  type SavedLook,
} from "@/lib/looks-storage";

type View = "outfits" | "pieces" | "looks";

type PublicationStatus = "pending" | "approved" | "rejected";

interface LookSubmission {
  id: string;
  lookId: string | null;
  generatedImage: string | null;
  status: PublicationStatus;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const CATEGORY_TO_SLOT: Record<string, string> = {
  outerwear: "outerwear",
  blazers: "outerwear",
  tops: "top",
  shirts: "top",
  knitwear: "top",
  dresses: "top",
  bottoms: "bottom",
  jeans: "bottom",
  shorts: "bottom",
  skirts: "bottom",
  footwear: "shoes",
  accessories: "accessories",
  bags: "accessories",
};

function StatusDot({ className }: { className: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${className}`} />;
}

function BagIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
      <path d="M6 8h12l-1 12H7L6 8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// ── Popover menu (anchored above the actions row) ─────────────────────────────
function ActionMenu({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop: dims on mobile so the menu reads as a sheet; an invisible
              click-catcher on desktop. */}
          <div
            className="fixed inset-0 z-[55] bg-black/40 sm:bg-transparent sm:z-40"
            onClick={onClose}
          />
          {/* On phones the menu is a bottom sheet pinned to the viewport, so it
              can never clip off-screen for cards in the left column. From sm: up
              it returns to an anchored dropdown above the trigger. */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.32, 0.72, 0, 1] }}
            className="fixed left-3 right-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[56] w-auto rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-xl py-1.5 sm:absolute sm:left-auto sm:right-0 sm:bottom-full sm:mb-2 sm:w-60 sm:rounded-xl sm:z-50"
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MenuItem({
  onClick,
  disabled,
  danger,
  icon,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-default ${
        danger
          ? "text-red-500 hover:bg-red-500/10"
          : "text-[var(--foreground)] hover:bg-[var(--surface)]"
      }`}
    >
      {icon && <span className="shrink-0 text-[var(--foreground-muted)]">{icon}</span>}
      <span className="truncate">{children}</span>
    </button>
  );
}

function MenuCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-4 pt-2 pb-1 text-[10px] leading-relaxed text-[var(--foreground-subtle)] border-t border-[var(--border)] mt-1.5">
      {children}
    </p>
  );
}

// ── Builder look card ─────────────────────────────────────────────────────────
function LookCard({
  look,
  onDelete,
  onRename,
  allProducts,
  publication,
  onSubmitted,
}: {
  look: SavedLook;
  onDelete: () => void;
  onRename: (id: string, name: string) => void;
  allProducts: Product[];
  publication: PublicationStatus | null;
  onSubmitted: (lookId: string, generatedImage: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { formatPrice } = useCurrency();
  const { addManyToCart } = useCart();
  const [submitState, setSubmitState] = useState<"idle" | "submitting">("idle");
  const [bagAdded, setBagAdded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [modalEditingName, setModalEditingName] = useState(false);
  const [menu, setMenu] = useState<"share" | "more" | null>(null);
  const [modalShare, setModalShare] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "working" | "copied" | "error">("idle");

  // System name by content type — used whenever the user hasn't named the look
  const autoName = !look.generatedImage
    ? "Created look"
    : look.generatedStyle === "tryon"
    ? "Generated look"
    : look.generatedStyle === "flatlay"
    ? "Flat lay look"
    : "AI look";
  const displayName = look.name || autoName;
  const [nameValue, setNameValue] = useState(look.name || autoName);

  // Availability — a piece counts only when we know it's sold out everywhere
  const totalPieces = look.pieces.length;
  const availablePieces = look.pieces.filter((p) =>
    isProductAvailable(allProducts.find((x) => x.id === p.productId))
  );
  const availableCount = availablePieces.length;
  const partial = availableCount < totalPieces;

  const handleAddToBag = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (bagAdded) return;
    const items = availablePieces.map((piece) => {
      const product = allProducts.find((p) => p.id === piece.productId);
      const officialRetailer = product?.retailers.find((r) => r.isOfficial) ?? product?.retailers[0] ?? null;
      return {
        id: piece.productId,
        name: piece.name ?? product?.name ?? piece.slot,
        brand: product?.brand ?? "",
        imageUrl: piece.imageUrl ?? product?.imageUrl ?? "",
        price: product?.priceMin ?? 0,
        retailerUrl: officialRetailer?.url ?? null,
      };
    });
    if (items.length === 0) return;
    addManyToCart(items);
    setBagAdded(true);
    setTimeout(() => setBagAdded(false), 2000);
  };

  const commitName = () => {
    const trimmed = nameValue.trim() || autoName;
    setNameValue(trimmed);
    setEditingName(false);
    setModalEditingName(false);
    if (trimmed !== (look.name || autoName)) onRename(look.id, trimmed === autoName ? "" : trimmed);
  };

  const canSubmit = !!look.generatedImage && publication !== "pending" && publication !== "approved";

  const handleSubmitForPublication = async () => {
    if (!canSubmit || submitState !== "idle") return;
    setSubmitState("submitting");
    try {
      await fetch("/api/looks/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lookId: look.id,
          generatedImage: look.generatedImage,
          generatedStyle: look.generatedStyle,
          pieces: look.pieces,
          totalPrice: look.totalPrice,
          styleKeywords: look.styleKeywords,
          // A saved look has carried a name and description all along; they
          // just were not being sent, so the catalogue never saw them.
          name: look.name,
          description: look.description,
        }),
      });
      onSubmitted(look.id, look.generatedImage ?? null);
      setMenu(null);
    } catch {
      // leave as idle so the user can retry
    }
    setSubmitState("idle");
  };

  // Priority order for display layout
  const SLOT_PRIORITY: Record<string, number> = {
    outerwear: 0, top: 1, bottom: 2, shoes: 3, accessories: 4, accessories2: 5,
  };

  const SLOT_LABEL: Record<string, string> = {
    outerwear: "Outerwear", top: "Top", bottom: "Bottom", shoes: "Shoes",
    accessories: "Accessory", accessories2: "Accessory",
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
        price: product?.priceMin ?? null,
        color: product?.colors?.[0] ?? null,
      };
    });

  const pieceParams = look.pieces
    .flatMap((p) => {
      const params = [`${p.slot}=${p.productId}`];
      if (p.variantId) params.push(`${p.slot}_variant=${p.variantId}`);
      return params;
    })
    .join("&");

  const builderUrl = "/builder?editId=" + look.id + "&" + pieceParams;

  // "Share link" publishes a snapshot of this look and points at its public
  // /look/[id] page — image on the left, the list of pieces on the right, the
  // same format as published / default looks. The link opens for anyone, even
  // when the look was never published to the catalog.
  //
  // Producing a link can never fail: the server confirms the snapshot row and
  // we hand out the clean /look/{id} URL; if persisting didn't work (DB down,
  // schema drift, network error) we fall back to a self-contained link that
  // carries the look in the URL, which the /look page renders without a row.
  // Generated images are hosted http(s) URLs, so the payload stays small.
  const sharePayload = () => ({
    name: look.name,
    description: look.description,
    pieces: look.pieces.map((p) => ({
      slot: p.slot,
      productId: p.productId,
      ...(p.variantId ? { variantId: p.variantId } : {}),
      ...(p.imageUrl && /^https?:\/\//.test(p.imageUrl) ? { imageUrl: p.imageUrl } : {}),
      ...(p.name ? { name: p.name } : {}),
    })),
    totalPrice: look.totalPrice,
    styleKeywords: look.styleKeywords,
    ...(look.generatedImage && /^https?:\/\//.test(look.generatedImage)
      ? { generatedImage: look.generatedImage }
      : {}),
    generatedStyle: look.generatedStyle,
  });

  // base64url with unicode support (look names can be any language)
  const encodeShareData = (payload: unknown): string => {
    const bytes = new TextEncoder().encode(JSON.stringify(payload));
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const selfContainedLink = (id: string) =>
    `${window.location.origin}/look/${id}?d=${encodeShareData(sharePayload())}`;

  // The request is kicked off as soon as the share UI opens, so by the time
  // the user taps "Share link" it has usually resolved and navigator.share()/
  // clipboard stay within the user-gesture window.
  const shareRequest = useRef<Promise<string> | null>(null);
  useEffect(() => {
    // A rename/edit invalidates the cached link — re-publish on next share.
    shareRequest.current = null;
  }, [look]);

  /** Resolves to a working share URL — never rejects. */
  const ensureShared = (): Promise<string> => {
    if (!shareRequest.current) {
      shareRequest.current = fetch("/api/looks/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: look.id,
          savedAt: look.savedAt,
          name: look.name,
          description: look.description,
          pieces: look.pieces,
          totalPrice: look.totalPrice,
          styleKeywords: look.styleKeywords,
          generatedImage: look.generatedImage,
          generatedStyle: look.generatedStyle,
        }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => null);
          const id = typeof data?.id === "string" ? data.id : look.id;
          if (res.ok && data?.persisted) {
            return `${window.location.origin}/look/${id}`;
          }
          return selfContainedLink(id);
        })
        .catch(() => selfContainedLink(look.id));
    }
    return shareRequest.current;
  };

  const closeShareUi = () => {
    setMenu(null);
    setModalShare(false);
  };

  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {}
    // Legacy path — the clipboard API can be unavailable or denied.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  };

  const shareLink = async () => {
    if (shareState === "working") return;
    setShareState("working");
    const url = await ensureShared();
    if (navigator.share) {
      try {
        await navigator.share({ title: displayName, url });
        setShareState("idle");
        closeShareUi();
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          // user dismissed the native sheet — nothing to report
          setShareState("idle");
          return;
        }
        // fall through to clipboard
      }
    }
    if (await copyToClipboard(url)) {
      setShareState("copied");
      setTimeout(() => { setShareState("idle"); closeShareUi(); }, 1500);
    } else {
      setShareState("error");
      setTimeout(() => setShareState("idle"), 2500);
    }
  };

  const shareLabel =
    shareState === "working"
      ? "Preparing link…"
      : shareState === "copied"
      ? "Link copied ✓"
      : shareState === "error"
      ? "Couldn't copy — tap to retry"
      : "Share link";

  // Start publishing as soon as the share UI opens, so the link is ready by
  // the time the user taps "Share link".
  const openShareMenu = () => {
    const next = menu === "share" ? null : "share";
    setMenu(next);
    if (next === "share") void ensureShared();
  };

  // Metadata segment: publication status > availability > origin
  const statusSegment =
    publication === "approved"
      ? { label: "Published to GOO", dot: "bg-green-500" }
      : publication === "pending"
      ? { label: "Pending approval", dot: "bg-orange-400" }
      : publication === "rejected"
      ? { label: "Rejected", dot: "bg-red-400" }
      : partial
      ? { label: `${availableCount}/${totalPieces} available`, dot: "bg-orange-400" }
      : look.generatedImage
      ? { label: "AI generated", dot: "bg-violet-400" }
      : { label: "Created by you", dot: null };

  return (
    <>
      <div className="group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        {/* Main image — click opens detail modal */}
        <button onClick={() => setOpen(true)} className="img-zoom block w-full text-left relative overflow-hidden rounded-t-2xl aspect-[3/4]">
          {look.generatedImage ? (
            <div className="absolute inset-0 overflow-hidden bg-[var(--surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={look.generatedImage}
                alt={displayName}
                className="w-full h-full object-cover"
              />
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
          {/* Type badge */}
          {look.generatedImage && (
            <span className="absolute top-2.5 left-2.5 z-10 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
              {look.generatedStyle === "flatlay" ? "Flat lay" : look.generatedStyle === "tryon" ? "On You" : "AI"}
            </span>
          )}
          <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
        </button>

        {/* Info */}
        <div className="px-4 pt-3.5 pb-4 flex flex-col">
          {editingName ? (
            <input
              type="text"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitName(); } if (e.key === "Escape") { setNameValue(look.name || autoName); setEditingName(false); } }}
              className="w-full text-[15px] font-semibold bg-transparent outline-none border-b border-[var(--foreground)] pb-0.5 text-[var(--foreground)] leading-snug"
              autoFocus
            />
          ) : (
            <button
              onClick={() => { setNameValue(look.name || autoName); setEditingName(true); }}
              className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug w-full text-left hover:opacity-70 transition-opacity"
              title="Click to rename"
            >
              {displayName}
            </button>
          )}

          {/* Metadata */}
          <p className="text-[13px] text-[var(--foreground-muted)] mt-1 truncate">
            {formatPrice(look.totalPrice)} total
          </p>
          <p className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)] mt-0.5 truncate">
            <span className="shrink-0">{totalPieces} {totalPieces === 1 ? "piece" : "pieces"}</span>
            <span className="opacity-50">•</span>
            {statusSegment.dot && <StatusDot className={statusSegment.dot} />}
            <span className="truncate">{statusSegment.label}</span>
          </p>

          {/* Primary action. Cards sit two-up on phones (~130px of row width),
              so the mobile label is shorter and the bag icon is desktop-only —
              otherwise the uppercase tracking overflows the pill. */}
          <button
            onClick={handleAddToBag}
            disabled={availableCount === 0}
            className={`mt-3 w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold transition-opacity disabled:opacity-30 disabled:cursor-default ${
              bagAdded
                ? "bg-green-600 text-white"
                : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
            }`}
          >
            {bagAdded ? (
              <>
                <span className="md:hidden">Added ✓</span>
                <span className="hidden md:inline">Added to bag ✓</span>
              </>
            ) : (
              <>
                <span className="md:hidden">{partial ? "Add available" : "Add to bag"}</span>
                <span className="hidden md:inline">{partial ? "Add available items" : "Add all to bag"}</span>
                <span className="hidden md:inline-flex"><BagIcon /></span>
              </>
            )}
          </button>

          {/* Secondary actions — taller, text-only buttons on phones (the
              icon+label pair doesn't fit the narrow two-up cards), the
              original compact icon+label row from md up. */}
          <div className="relative flex items-center gap-2 md:gap-1.5 mt-2.5">
            <Link
              href={builderUrl}
              className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="hidden md:block">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Z" />
              </svg>
              Edit
            </Link>
            <button
              onClick={openShareMenu}
              className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="hidden md:block">
                <path d="M12 3v12M12 3 8 7m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Share
            </button>
            <button
              onClick={() => setMenu(menu === "more" ? null : "more")}
              aria-label="More actions"
              className="w-10 h-10 md:w-8 md:h-8 shrink-0 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
              </svg>
            </button>

            {/* Share menu */}
            <ActionMenu open={menu === "share"} onClose={() => setMenu(null)}>
              <MenuItem
                onClick={shareLink}
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v12M12 3 8 7m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                }
              >
                {shareLabel}
              </MenuItem>
              <MenuItem
                onClick={handleSubmitForPublication}
                disabled={!canSubmit || submitState === "submitting"}
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M12 19V5m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
              >
                {publication === "pending"
                  ? "Pending approval"
                  : publication === "approved"
                  ? "Published to GOO"
                  : submitState === "submitting"
                  ? "Submitting…"
                  : "Submit for publication"}
              </MenuItem>
              <MenuCaption>
                Publication requires admin approval.
                {!look.generatedImage && " Generate an image for this look to submit it."}
              </MenuCaption>
            </ActionMenu>

            {/* More menu */}
            <ActionMenu open={menu === "more"} onClose={() => setMenu(null)}>
              <MenuItem onClick={() => { setMenu(null); setNameValue(look.name || autoName); setEditingName(true); }}>
                Rename
              </MenuItem>
              {look.generatedImage && (
                <a
                  href={look.generatedImage}
                  download="goo-look.jpg"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenu(null)}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
                >
                  Download image
                </a>
              )}
              <MenuItem danger onClick={() => { setMenu(null); setConfirmDelete(true); }}>
                Delete look
              </MenuItem>
            </ActionMenu>
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
          onClick={() => { setOpen(false); setModalEditingName(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 12 }}
            transition={{ duration: 0.2 }}
            className={`bg-[var(--background)] w-full overflow-hidden flex flex-col rounded-2xl max-w-3xl`}
            style={{ height: "min(90vh, 680px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header — name + metadata only, actions live in the right column */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div className="flex-1 min-w-0 mr-4">
                {modalEditingName ? (
                  <input
                    type="text"
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onBlur={commitName}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); commitName(); }
                      if (e.key === "Escape") { setNameValue(look.name || autoName); setModalEditingName(false); }
                    }}
                    className="w-full text-[17px] font-bold bg-transparent outline-none border-b border-[var(--foreground)] pb-0.5 text-[var(--foreground)] leading-snug"
                    placeholder="Name this look…"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setNameValue(look.name || autoName); setModalEditingName(true); }}
                    className="flex items-center gap-2 group/rename max-w-full"
                    title="Rename"
                  >
                    <span className="text-[17px] font-bold text-[var(--foreground)] leading-snug truncate">
                      {displayName}
                    </span>
                    <svg
                      width="11" height="11" viewBox="0 0 16 16" fill="currentColor"
                      className="shrink-0 text-[var(--foreground-subtle)] opacity-40 group-hover/rename:opacity-90 transition-opacity"
                    >
                      <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Z" />
                    </svg>
                  </button>
                )}
                <p className="flex items-center gap-1.5 text-[12px] text-[var(--foreground-muted)] mt-1 truncate">
                  <span>{formatPrice(look.totalPrice)} total</span>
                  <span className="opacity-50">•</span>
                  <span>{totalPieces} {totalPieces === 1 ? "piece" : "pieces"}</span>
                  {partial && (
                    <>
                      <span className="opacity-50">•</span>
                      <StatusDot className="bg-orange-400" />
                      <span>{availableCount}/{totalPieces} available</span>
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => { setOpen(false); setModalEditingName(false); setModalShare(false); }}
                aria-label="Close"
                className="mt-1 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex min-h-0 flex-1">
              {/* Left: single look image (or collage when no image) — no carousel */}
              <div className="relative w-[56%] shrink-0 border-r border-[var(--border)] overflow-hidden bg-[var(--surface)]">
                {look.generatedImage ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={look.generatedImage}
                      alt={displayName}
                      className="w-full h-full object-cover object-top"
                    />
                    {look.generatedStyle && (
                      <span className="absolute top-3 left-3 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-1 rounded-md backdrop-blur-sm">
                        {look.generatedStyle === "flatlay" ? "Flat lay" : look.generatedStyle === "tryon" ? "On You" : "AI"}
                      </span>
                    )}
                    <a
                      href={look.generatedImage}
                      download="goo-look.jpg"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Download image"
                      aria-label="Download image"
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-[var(--background)]/85 backdrop-blur-sm flex items-center justify-center text-[var(--foreground)] hover:bg-[var(--background)] transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M12 3v12m0 0-4-4m4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </a>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gray-200 flex flex-col gap-px">
                    {(() => {
                      const n = pieces.length;
                      const cell = (piece: typeof pieces[0], pad = "p-3") => (
                        <div key={piece.slot} className="relative flex-1 overflow-hidden bg-white min-w-0">
                          {piece.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={piece.imageUrl} alt={piece.name} className={`absolute inset-0 w-full h-full object-contain ${pad}`} />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <span className="font-mono text-[8px] uppercase text-gray-400 capitalize">{piece.slot}</span>
                            </div>
                          )}
                        </div>
                      );
                      if (n === 0) return <div className="flex-1 flex items-center justify-center"><p className="font-mono text-[9px] uppercase text-gray-400">No pieces</p></div>;
                      if (n === 1) return cell(pieces[0], "p-8");
                      if (n === 2) return <div className="flex gap-px flex-1">{pieces.slice(0, 2).map(p => cell(p))}</div>;
                      if (n === 3) return (
                        <>
                          <div className="flex gap-px" style={{ flex: "0 0 60%" }}>{pieces.slice(0, 2).map(p => cell(p))}</div>
                          <div className="flex" style={{ flex: "0 0 40%" }}>{cell(pieces[2], "p-2")}</div>
                        </>
                      );
                      if (n === 4) return (
                        <>
                          <div className="flex gap-px flex-1">{pieces.slice(0, 2).map(p => cell(p))}</div>
                          <div className="flex gap-px flex-1">{pieces.slice(2, 4).map(p => cell(p))}</div>
                        </>
                      );
                      if (n === 5) return (
                        <>
                          <div className="flex gap-px" style={{ flex: "0 0 57%" }}>{pieces.slice(0, 2).map(p => cell(p))}</div>
                          <div className="flex gap-px" style={{ flex: "0 0 43%" }}>{pieces.slice(2, 5).map(p => cell(p, "p-2"))}</div>
                        </>
                      );
                      return (
                        <>
                          <div className="flex gap-px" style={{ flex: "0 0 40%" }}>{pieces.slice(0, 2).map(p => cell(p))}</div>
                          <div className="flex gap-px" style={{ flex: "0 0 33%" }}>{pieces.slice(2, 5).map(p => cell(p, "p-2"))}</div>
                          <div className="flex" style={{ flex: "0 0 27%" }}>{cell(pieces[5], "p-2")}</div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Right: pieces list + actions */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 overflow-y-auto divide-y divide-[var(--border)]">
                  {pieces.length > 0 ? pieces.map(({ slot, imageUrl, name, productId, price, color }) => (
                    <Link
                      key={slot}
                      href={`/product/${productId}`}
                      onClick={() => setOpen(false)}
                      className="group/item flex items-center gap-3 px-4 py-3 hover:bg-[var(--surface)] transition-colors"
                    >
                      <div className="w-14 h-14 shrink-0 bg-white overflow-hidden rounded-lg border border-[var(--border)]">
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
                        <p className="font-mono text-[8px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)] mb-0.5">{SLOT_LABEL[slot] ?? slot}</p>
                        <p className="text-xs text-[var(--foreground)] leading-snug line-clamp-2">{name}</p>
                        {(price !== null || color) && (
                          <p className="text-[11px] text-[var(--foreground-muted)] mt-0.5 truncate">
                            {[price !== null ? formatPrice(price) : null, color].filter(Boolean).join(" • ")}
                          </p>
                        )}
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

                {/* Footer: total, primary action, secondary actions, publication */}
                <div className="shrink-0 border-t border-[var(--border)] px-4 pt-3.5 pb-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] font-medium text-[var(--foreground)]">Total</span>
                    <span className="text-[15px] font-semibold text-[var(--foreground)]">{formatPrice(look.totalPrice)}</span>
                  </div>

                  <button
                    onClick={handleAddToBag}
                    disabled={availableCount === 0}
                    className={`mt-3 w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold transition-opacity disabled:opacity-30 disabled:cursor-default ${
                      bagAdded
                        ? "bg-green-600 text-white"
                        : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
                    }`}
                  >
                    {bagAdded ? (
                      <>
                        <span className="md:hidden">Added ✓</span>
                        <span className="hidden md:inline">Added to bag ✓</span>
                      </>
                    ) : (
                      <>
                        <span className="md:hidden">{partial ? "Add available" : "Add to bag"}</span>
                        <span className="hidden md:inline">{partial ? "Add available items" : "Add all to bag"}</span>
                        <span className="hidden md:inline-flex"><BagIcon /></span>
                      </>
                    )}
                  </button>

                  <div className="relative flex items-center gap-2 md:gap-1.5 mt-2.5">
                    <Link
                      href={builderUrl}
                      onClick={() => setOpen(false)}
                      className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="hidden md:block">
                        <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Z" />
                      </svg>
                      Edit
                    </Link>
                    <button
                      onClick={() => setModalShare((v) => { const next = !v; if (next) void ensureShared(); return next; })}
                      className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="hidden md:block">
                        <path d="M12 3v12M12 3 8 7m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      Share
                    </button>
                    <ActionMenu open={modalShare} onClose={() => setModalShare(false)}>
                      <MenuItem onClick={shareLink}>{shareLabel}</MenuItem>
                    </ActionMenu>
                  </div>

                  {/* Publication status block */}
                  {publication === "approved" ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" stroke="currentColor" strokeWidth="1.6" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[var(--foreground)]">Published to GOO</span>
                        <span className="block text-[11px] text-[var(--foreground-subtle)]">This look is live on the site.</span>
                      </span>
                    </div>
                  ) : publication === "pending" ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-orange-400/15 text-orange-400 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[var(--foreground)]">Pending approval</span>
                        <span className="block text-[11px] text-[var(--foreground-subtle)]">Your look is awaiting admin review.</span>
                      </span>
                    </div>
                  ) : publication === "rejected" ? (
                    <div className="mt-3 flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-red-400/15 text-red-400 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
                          <path d="M9 9l6 6M15 9l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[var(--foreground)]">Rejected</span>
                        <span className="block text-[11px] text-[var(--foreground-subtle)]">This look wasn&apos;t approved for publication.</span>
                      </span>
                    </div>
                  ) : look.generatedImage ? (
                    <button
                      onClick={handleSubmitForPublication}
                      disabled={submitState === "submitting"}
                      className="mt-3 w-full flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-left hover:border-[var(--border-strong)] transition-colors disabled:opacity-50 disabled:cursor-default"
                    >
                      <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--fg-overlay-08)] text-[var(--foreground)] flex items-center justify-center">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M12 19V5m0 0-5 5m5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold text-[var(--foreground)]">
                          {submitState === "submitting" ? "Submitting…" : "Submit for publication"}
                        </span>
                        <span className="block text-[11px] text-[var(--foreground-subtle)]">Send this look for admin approval before it appears on GOO.</span>
                      </span>
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

// ── Liked outfit card (Outfits tab) ───────────────────────────────────────────
function SavedOutfitCard({ outfit }: { outfit: Outfit }) {
  const { formatPrice } = useCurrency();
  const { addManyToCart } = useCart();
  const { toggleOutfitLike } = useLikes();
  const [bagAdded, setBagAdded] = useState(false);
  const [menu, setMenu] = useState<"share" | "more" | null>(null);
  const [copied, setCopied] = useState(false);

  const totalPieces = outfit.items.length;
  const availableItems = outfit.items.filter((it) => isProductAvailable(it.product));
  const availableCount = availableItems.length;
  const partial = availableCount < totalPieces;

  const outfitUrl = `/outfit/${outfit.id}`;

  const builderUrl = (() => {
    const params: string[] = [];
    const used = new Set<string>();
    for (const it of outfit.items) {
      let slot = CATEGORY_TO_SLOT[it.product.category];
      if (slot === "accessories" && used.has(slot)) slot = "accessories2";
      if (slot && !used.has(slot)) {
        params.push(`${slot}=${it.product.id}`);
        used.add(slot);
      }
    }
    return params.length > 0 ? `/builder?${params.join("&")}` : "/builder";
  })();

  const handleAddToBag = () => {
    if (bagAdded) return;
    const items = availableItems.map(({ product }) => {
      const officialRetailer = product.retailers.find((r) => r.isOfficial) ?? product.retailers[0] ?? null;
      return {
        id: product.id,
        name: product.name,
        brand: product.brand,
        imageUrl: product.imageUrl,
        price: product.priceMin,
        retailerUrl: officialRetailer?.url ?? null,
      };
    });
    if (items.length === 0) return;
    addManyToCart(items);
    setBagAdded(true);
    setTimeout(() => setBagAdded(false), 2000);
  };

  const shareUrl = () => `${window.location.origin}${outfitUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl());
      setCopied(true);
      setTimeout(() => { setCopied(false); setMenu(null); }, 1200);
    } catch {}
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: outfit.name || "Saved outfit", url: shareUrl() });
      } else {
        await navigator.clipboard.writeText(shareUrl());
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
      setMenu(null);
    } catch {}
  };

  const statusSegment = partial
    ? { label: `${availableCount}/${totalPieces} available`, dot: "bg-orange-400" }
    : { label: "Ready to shop", dot: "bg-green-500" };

  return (
    <div className="group relative flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      {/* Image — click opens the outfit page */}
      <Link href={outfitUrl} className="img-zoom block w-full relative overflow-hidden rounded-t-2xl aspect-[3/4]">
        {outfit.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={outfit.imageUrl} alt={outfit.name || "Saved outfit"} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid grid-cols-2 gap-px bg-gray-200">
            {outfit.items.slice(0, 4).map(({ product }) => (
              <div key={product.id} className="relative overflow-hidden bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={product.imageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-contain p-2" />
              </div>
            ))}
          </div>
        )}
        <span className="absolute top-2.5 left-2.5 z-10 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-0.5 rounded-md backdrop-blur-sm">
          Outfit
        </span>
        <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--fg-overlay-08)] transition-colors duration-500 z-10" />
      </Link>

      {/* Info */}
      <div className="px-4 pt-3.5 pb-4 flex flex-col">
        <Link href={outfitUrl} className="text-[15px] font-semibold text-[var(--foreground)] truncate leading-snug hover:opacity-70 transition-opacity">
          Saved outfit
        </Link>
        <p className="text-[13px] text-[var(--foreground-muted)] mt-1 truncate">
          {formatPrice(outfit.totalPriceMin)} total
        </p>
        <p className="flex items-center gap-1.5 text-[11px] text-[var(--foreground-subtle)] mt-0.5 truncate">
          <span className="shrink-0">{totalPieces} {totalPieces === 1 ? "piece" : "pieces"}</span>
          <span className="opacity-50">•</span>
          <StatusDot className={statusSegment.dot} />
          <span className="truncate">{statusSegment.label}</span>
        </p>

        {/* Primary action — same responsive treatment as the look cards:
            shorter label and no bag icon on the narrow two-up phone cards. */}
        <button
          onClick={handleAddToBag}
          disabled={availableCount === 0}
          className={`mt-3 w-full h-11 md:h-10 rounded-xl flex items-center justify-center gap-2 text-[11px] tracking-[0.1em] uppercase font-semibold transition-opacity disabled:opacity-30 disabled:cursor-default ${
            bagAdded
              ? "bg-green-600 text-white"
              : "bg-[var(--foreground)] text-[var(--background)] hover:opacity-90"
          }`}
        >
          {bagAdded ? (
            <>
              <span className="md:hidden">Added ✓</span>
              <span className="hidden md:inline">Added to bag ✓</span>
            </>
          ) : (
            <>
              <span className="md:hidden">{partial ? "Add available" : "Add to bag"}</span>
              <span className="hidden md:inline">{partial ? "Add available items" : "Add all to bag"}</span>
              <span className="hidden md:inline-flex"><BagIcon /></span>
            </>
          )}
        </button>

        {/* Secondary actions — taller text-only buttons on phones, the
            original compact icon+label row from md up. */}
        <div className="relative flex items-center gap-2 md:gap-1.5 mt-2.5">
          <Link
            href={builderUrl}
            className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" className="hidden md:block">
              <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Z" />
            </svg>
            Edit
          </Link>
          <button
            onClick={() => setMenu(menu === "share" ? null : "share")}
            className="flex-1 h-10 md:h-8 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center gap-1.5 text-[12px] md:text-[11px] font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="hidden md:block">
              <path d="M12 3v12M12 3 8 7m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Share
          </button>
          <button
            onClick={() => setMenu(menu === "more" ? null : "more")}
            aria-label="More actions"
            className="w-10 h-10 md:w-8 md:h-8 shrink-0 rounded-xl md:rounded-lg border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
            </svg>
          </button>

          <ActionMenu open={menu === "share"} onClose={() => setMenu(null)}>
            <MenuItem onClick={copyLink}>{copied ? "Link copied ✓" : "Copy link"}</MenuItem>
            <MenuItem onClick={shareLink}>Share link</MenuItem>
          </ActionMenu>

          <ActionMenu open={menu === "more"} onClose={() => setMenu(null)}>
            <Link
              href={outfitUrl}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
            >
              View outfit
            </Link>
            <MenuItem danger onClick={() => { setMenu(null); toggleOutfitLike(outfit.id); }}>
              Remove from likes
            </MenuItem>
          </ActionMenu>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const [view, setView] = useState<View>("looks");
  const { likedOutfits, likedProducts, unseenOutfits, unseenProducts, markCategorySeen } = useLikes();
  const { user, isLoaded } = useUser();
  const [myLooks, setMyLooks] = useState<SavedLook[]>([]);
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [allProducts, setAllProducts] = useState(staticProducts);
  const [submissions, setSubmissions] = useState<LookSubmission[]>([]);

  // Load saved looks — from API when logged in, else from localStorage
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("tab") === "looks") setView("looks");
  }, []);

  // Opening a tab clears just that tab's "new items" badge. Re-runs as likes
  // load / change while the tab is open so anything seen here counts as seen.
  useEffect(() => {
    if (view === "pieces") markCategorySeen("products");
    else if (view === "outfits") markCategorySeen("outfits");
  }, [view, likedOutfits, likedProducts, markCategorySeen]);

  useEffect(() => {
    if (!isLoaded) return;
    // Show the local cache immediately (has the latest names), then reconcile
    // with the account so looks created on other devices appear and any
    // local-only looks are pushed up.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyLooks(loadLocalLooks());

    let cancelled = false;
    syncLooks(!!user).then((looks) => {
      if (!cancelled) setMyLooks(looks);
    });

    if (user) {
      // Publication statuses for looks submitted to GOO
      fetch("/api/user/look-submissions")
        .then((r) => r.json())
        .then((d: LookSubmission[]) => { if (Array.isArray(d)) setSubmissions(d); })
        .catch(() => {});
    }

    return () => { cancelled = true; };
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
      saveLocalLooks(next);
      if (user) void deleteLookFromServer(id);
      return next;
    });
  };

  const renameLook = (id: string, name: string) => {
    setMyLooks((prev) => {
      const next = prev.map((l) => l.id === id ? { ...l, name: name || undefined } : l);
      saveLocalLooks(next);
      if (user) {
        const look = next.find((l) => l.id === id);
        if (look) void pushLook(look);
      }
      return next;
    });
  };

  /** Latest submission status for a look — matched by id, with image fallback
   *  for submissions created before look_id was stored. */
  const publicationFor = (look: SavedLook): PublicationStatus | null => {
    const byId = submissions.find((s) => s.lookId === look.id);
    if (byId) return byId.status;
    if (look.generatedImage) {
      const byImage = submissions.find((s) => s.generatedImage === look.generatedImage);
      if (byImage) return byImage.status;
    }
    return null;
  };

  const markSubmitted = (lookId: string, generatedImage: string | null) => {
    setSubmissions((prev) => [
      { id: `local-${lookId}`, lookId, generatedImage, status: "pending" },
      ...prev,
    ]);
  };

  const savedOutfits = allOutfits.filter((o) => likedOutfits.includes(o.id));
  const savedProducts = allProducts.filter((p) => likedProducts.includes(p.id));

  // Counts mirror what's actually rendered: a liked id whose product/outfit is
  // no longer in the catalog isn't shown, so it must not inflate the tab count.
  const tabs: { id: View; label: string; count: number; unseen: number }[] = [
    { id: "looks", label: "My Looks", count: myLooks.length, unseen: 0 },
    { id: "pieces", label: "Pieces", count: savedProducts.length, unseen: unseenProducts },
    { id: "outfits", label: "Outfits", count: savedOutfits.length, unseen: unseenOutfits },
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
        <div className="flex gap-0 mb-10 w-fit max-w-full overflow-x-auto no-scrollbar bg-[var(--surface)] rounded-full p-1 border border-[var(--border)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className="relative shrink-0 px-5 py-2 text-xs tracking-[0.12em] uppercase font-medium rounded-full z-10 transition-colors duration-200"
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
              {t.unseen > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center rounded-full font-bold align-middle"
                  style={{
                    minWidth: 16, height: 16, padding: "0 4px", fontSize: 9, lineHeight: 1,
                    background: view === t.id ? "var(--background)" : "var(--foreground)",
                    color: view === t.id ? "var(--foreground)" : "var(--background)",
                  }}
                >
                  {t.unseen > 9 ? "9+" : t.unseen}
                </span>
              )}
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
                  variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
                >
                  <SavedOutfitCard outfit={outfit} />
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
                  <LookCard
                    look={look}
                    onDelete={() => deleteLook(look.id)}
                    onRename={renameLook}
                    allProducts={allProducts}
                    publication={publicationFor(look)}
                    onSubmitted={markSubmitted}
                  />
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
