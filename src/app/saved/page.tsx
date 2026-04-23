"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLikes } from "@/lib/context/likes-context";
import { products as staticProducts } from "@/lib/data/products";
import type { Outfit } from "@/lib/types";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";

type View = "outfits" | "pieces" | "looks";

// ── Saved builder outfit type ─────────────────────────────────────────────────
interface SavedLook {
  id: string;
  savedAt: string;
  pieces: { slot: string; productId: string; variantId?: string | null; imageUrl?: string; name?: string }[];
  totalPrice: number;
  styleKeywords: string[];
  generatedImage?: string | null;
  generatedStyle?: "mannequin" | "flatlay" | "tryon";
}

const SLOT_ORDER = ["outerwear", "top", "bottom", "shoes", "accessories"];

// ── Builder outfit card ───────────────────────────────────────────────────────
function LookCard({ look, onDelete }: { look: SavedLook; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "submitting" | "done">("idle");

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

  const pieces = SLOT_ORDER
    .map((slot) => {
      const piece = look.pieces.find((p) => p.slot === slot);
      if (!piece) return null;
      const product = staticProducts.find((p) => p.id === piece.productId);
      const imageUrl = piece.imageUrl ?? product?.imageUrl ?? null;
      const name = piece.name ?? product?.name ?? slot;
      return { slot, imageUrl, name, productId: piece.productId };
    })
    .filter(Boolean) as { slot: string; imageUrl: string | null; name: string; productId: string }[];

  const builderUrl =
    "/builder?editId=" + look.id + "&" +
    look.pieces
      .flatMap((p) => {
        const params = [`${p.slot}=${p.productId}`];
        if (p.variantId) params.push(`${p.slot}_variant=${p.variantId}`);
        return params;
      })
      .join("&");

  const date = new Date(look.savedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 2500);
    }
  };

  return (
    <>
      <div className="bg-[var(--background)] flex flex-col">
        {/* Main image — AI render or product grid */}
        <button onClick={() => setOpen(true)} className="block w-full text-left relative group overflow-hidden">
          {look.generatedImage ? (
            <div className="relative aspect-[3/4] overflow-hidden bg-[var(--surface)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={look.generatedImage}
                alt="Generated look"
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
              />
              <span className="absolute top-2.5 left-2.5 font-mono text-[8px] tracking-[0.18em] uppercase bg-black/55 text-white px-2 py-0.5 backdrop-blur-sm">
                {look.generatedStyle === "flatlay" ? "Flat lay" : look.generatedStyle === "tryon" ? "On You" : "AI"}
              </span>
            </div>
          ) : pieces.length > 0 ? (
            /* Editorial grid: hero top + items row */
            <div className="aspect-[3/4] flex flex-col gap-px bg-[var(--border)]">
              {/* Hero — first piece */}
              <div className="flex-[3] overflow-hidden bg-[var(--surface)]">
                {pieces[0].imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={pieces[0].imageUrl}
                    alt={pieces[0].name}
                    className="w-full h-full object-contain p-3 group-hover:scale-[1.03] transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-mono text-[9px] uppercase text-[var(--foreground-subtle)]">{pieces[0].slot}</span>
                  </div>
                )}
              </div>
              {/* Bottom row — remaining pieces */}
              {pieces.length > 1 && (
                <div className="flex flex-[1] gap-px bg-[var(--border)]">
                  {pieces.slice(1, 4).map((piece) => (
                    <div key={piece.slot} className="flex-1 overflow-hidden bg-[var(--surface)]">
                      {piece.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={piece.imageUrl}
                          alt={piece.name}
                          className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="font-mono text-[8px] uppercase text-[var(--border-strong)]">{piece.slot[0]}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* No pieces yet */
            <div className="aspect-[3/4] bg-[var(--surface)] flex flex-col items-center justify-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="opacity-20">
                <rect x="3" y="3" width="18" height="18" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-[9px] uppercase text-[var(--foreground-subtle)] opacity-50">Empty look</span>
            </div>
          )}
        </button>

        {/* Footer */}
        <div className="px-3 pt-2.5 pb-3 flex items-start justify-between gap-2 border-t border-[var(--border)]">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[var(--foreground)] leading-none">
              ${look.totalPrice.toLocaleString()}
            </p>
            {look.styleKeywords.length > 0 && (
              <p className="text-[9px] font-mono tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-1.5 truncate">
                {look.styleKeywords.slice(0, 3).join(" · ")}
              </p>
            )}
            <p className="text-[9px] text-[var(--foreground-subtle)] mt-1">{date}</p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <Link
              href={builderUrl}
              className="h-7 px-3 flex items-center text-[9px] tracking-[0.1em] uppercase font-medium border border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)] transition-colors"
            >
              Edit
            </Link>
            {look.generatedImage && (
              <button
                onClick={handleShare}
                disabled={shareState !== "idle"}
                title={shareState === "done" ? "Submitted for review" : "Share this look"}
                className={`h-7 px-2.5 flex items-center text-[9px] tracking-[0.1em] uppercase font-medium border transition-colors ${
                  shareState === "done"
                    ? "border-green-500/40 text-green-500 bg-green-500/5"
                    : "border-[var(--border)] text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:border-[var(--border-strong)]"
                } disabled:cursor-default`}
              >
                {shareState === "done" ? "Sent" : shareState === "submitting" ? "…" : "Share"}
              </button>
            )}
            <button
              onClick={handleDelete}
              title={confirmDelete ? "Click again to confirm" : "Delete look"}
              className={`h-7 w-7 flex items-center justify-center border transition-colors ${
                confirmDelete
                  ? "border-red-500 text-red-500 bg-red-500/5"
                  : "border-[var(--border)] text-[var(--foreground-subtle)] hover:border-red-400 hover:text-red-400"
              }`}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ── Look preview modal ── */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className={`bg-[var(--background)] w-full overflow-hidden flex flex-col ${
              look.generatedImage ? "max-w-3xl" : "max-w-lg"
            }`}
            style={{ maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
              <div>
                <p className="text-[13px] font-medium text-[var(--foreground)]">
                  ${look.totalPrice.toLocaleString()}
                </p>
                {look.styleKeywords.length > 0 && (
                  <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] mt-1">
                    {look.styleKeywords.slice(0, 3).join(" · ")}
                  </p>
                )}
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
                      <div className="w-14 h-14 shrink-0 bg-[var(--surface)] overflow-hidden border border-[var(--border)]">
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
              /* ── No generated image: pieces grid ── */
              <div className="overflow-y-auto">
                <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
                  {pieces.map(({ slot, imageUrl, name, productId }) => (
                    <Link
                      key={slot}
                      href={`/product/${productId}`}
                      onClick={() => setOpen(false)}
                      className="group/item bg-[var(--surface)] block relative overflow-hidden"
                    >
                      <div className="aspect-[4/5] overflow-hidden">
                        {imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={imageUrl}
                            alt={name}
                            className="w-full h-full object-contain p-3 group-hover/item:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <span className="font-mono text-[9px] uppercase text-[var(--border-strong)] capitalize">{slot}</span>
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 border-t border-[var(--border)]">
                        <p className="font-mono text-[8px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)] capitalize">{slot}</p>
                        <p className="text-[11px] text-[var(--foreground)] truncate mt-0.5">{name}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SavedPage() {
  const [view, setView] = useState<View>("looks");
  const { likedOutfits, likedProducts } = useLikes();
  const [myLooks, setMyLooks] = useState<SavedLook[]>([]);
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [allProducts, setAllProducts] = useState(staticProducts);

  // Load builder-saved outfits from localStorage + respect ?tab= param
  useEffect(() => {
    try {
      const raw = localStorage.getItem("goo-saved-outfits");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setMyLooks(JSON.parse(raw));
    } catch {}
    const params = new URLSearchParams(window.location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (params.get("tab") === "looks") setView("looks");
  }, []);

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
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16 mb-10">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
            Saved
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)]">
            Your Likes
          </h1>
        </div>

        {/* Toggle */}
        <div className="flex gap-px bg-[var(--border)] mb-10 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={`px-6 py-2.5 text-xs tracking-[0.12em] uppercase font-medium transition-colors duration-200 ${
                view === t.id
                  ? "bg-[var(--foreground)] text-[var(--background)]"
                  : "bg-[var(--background)] text-[var(--foreground-muted)] hover:bg-[var(--surface)]"
              }`}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        {/* ── Outfits (liked) ── */}
        {view === "outfits" && (
          savedOutfits.length > 0 ? (
            <div className="flex flex-wrap">
              {savedOutfits.map((outfit) => (
                <div key={outfit.id} className="w-1/2 md:w-1/4 lg:w-1/5 border-r border-b border-[var(--border)] bg-[var(--background)] p-3">
                  <OutfitCard outfit={outfit} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center">
              <p className="font-display text-2xl font-light text-[var(--foreground)] mb-3">
                No saved outfits yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any outfit to save it here.
              </p>
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
              >
                Browse Outfits
              </Link>
            </div>
          )
        )}

        {/* ── Pieces (liked) ── */}
        {view === "pieces" && (
          savedProducts.length > 0 ? (
            <div className="flex flex-wrap">
              {savedProducts.map((product) => (
                <div key={product.id} className="w-1/2 md:w-1/4 lg:w-1/5 border-r border-b border-[var(--border)] bg-[var(--background)] p-3">
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center">
              <p className="font-display text-2xl font-light text-[var(--foreground)] mb-3">
                No saved pieces yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Tap the heart on any item to save it here.
              </p>
              <Link
                href="/browse?view=pieces"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
              >
                Browse Pieces
              </Link>
            </div>
          )
        )}

        {/* ── My Looks (builder-created) ── */}
        {view === "looks" && (
          myLooks.length > 0 ? (
            <div className="flex flex-wrap">
              {myLooks.map((look) => (
                <div key={look.id} className="w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 border-r border-b border-[var(--border)]">
                  <LookCard look={look} onDelete={() => deleteLook(look.id)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 text-center">
              <p className="font-display text-2xl font-light text-[var(--foreground)] mb-3">
                No looks built yet
              </p>
              <p className="text-sm text-[var(--foreground-muted)] mb-8">
                Use the Builder to assemble outfits — hit Save and they appear here.
              </p>
              <Link
                href="/builder"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
              >
                Open Builder
              </Link>
            </div>
          )
        )}
      </div>
    </div>
  );
}
