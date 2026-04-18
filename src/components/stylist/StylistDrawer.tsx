"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";

// ── Internal types ────────────────────────────────────────────────────────────

interface OutfitPiece {
  slot: string;
  productId: string;
  name: string;
  brand: string;
  priceMin: number;
  styleKeywords: string[];
  category: string;
}

export interface BrowseContext {
  view: "outfits" | "pieces";
  searchQuery?: string;
  categories?: string[];
  brands?: string[];
  occasions?: string[];
  gender?: string;
  priceLabel?: string;
  visibleCount?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  suggestions?: Product[];
  isError?: true;
}

// Surface-specific quick reply chips
const QUICK_REPLIES: Record<StylistDrawerProps["surface"], readonly string[]> = {
  builder: ["Warmer", "Sharper", "Under $500", "Complete my look"],
  product: ["What goes with this?", "How to style it?", "Similar pieces", "Build an outfit"],
  browse:  ["Minimal looks", "What's trending?", "Under $500", "Complete an outfit"],
};

function makeWelcome(focusProduct?: Product): ChatMessage {
  if (focusProduct) {
    return {
      id: "welcome",
      role: "assistant",
      text: `Hi! I'm your AI Stylist. I can help you style the ${focusProduct.name} by ${focusProduct.brand} — ask me what goes with it, how to wear it, or for outfit ideas.`,
    };
  }
  return {
    id: "welcome",
    role: "assistant",
    text: "Hi! I'm your AI Stylist. Tell me what vibe you're going for, or pick a prompt below.",
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Page surface — shapes the outfit context sent to the API. */
  surface: "builder" | "browse" | "product";
  /** Full product catalog in memory — used to resolve suggestedProductIds. */
  products: Product[];
  /**
   * Controls how the drawer is positioned.
   * "absolute" — contained within a relative-positioned parent (builder).
   * "fixed"    — overlays the viewport below the site nav (product, browse).
   * Defaults to "fixed".
   */
  position?: "fixed" | "absolute";
  /**
   * Current outfit selection (builder only).
   * Keys are slot IDs, values are selected Products.
   */
  selection?: Partial<Record<string, Product>>;
  /**
   * Called when the user taps a suggestion card (builder: adds to canvas).
   * When absent, suggestion cards link to /product/[id] instead.
   */
  onSelectProduct?: (product: Product) => void;
  /**
   * Product the user is currently viewing (product page only).
   * Seeds the AI's context so it can answer "what goes with this?".
   */
  focusProduct?: Product;
  /**
   * Active filter/search state from the browse page (browse only).
   * Tells the AI what the user is currently looking at.
   */
  browseContext?: BrowseContext;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StylistDrawer({
  isOpen,
  onClose,
  surface,
  products,
  position = "fixed",
  selection,
  onSelectProduct,
  focusProduct,
  browseContext,
}: StylistDrawerProps) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [makeWelcome(focusProduct)]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatThreadRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom after every message or loading-state change
  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || chatLoading) return;
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "user", text: text.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      // conversationHistory reads closure state (pre-setState), correctly excluding
      // the just-queued user message. Error bubbles excluded so they don't confuse
      // the model on retries. Capped to last 20 entries (~10 turns).
      const conversationHistory = chatMessages
        .filter(m => m.id !== "welcome" && !m.isError)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.text }))
        .slice(-20);

      // Serialize builder outfit selection into the OutfitPiece shape the API expects.
      const currentOutfit: Record<string, OutfitPiece> = selection
        ? Object.fromEntries(
            Object.entries(selection)
              .filter(([, p]) => p != null)
              .map(([slot, p]) => [
                slot,
                {
                  slot,
                  productId: p!.id,
                  name: p!.name,
                  brand: p!.brand,
                  priceMin: p!.priceMin,
                  styleKeywords: p!.styleKeywords,
                  category: p!.category,
                },
              ])
          )
        : {};

      // Serialize the focus product (product page) for the API context block.
      const focusOutfitPiece: OutfitPiece | undefined = focusProduct
        ? {
            slot: "focus",
            productId: focusProduct.id,
            name: focusProduct.name,
            brand: focusProduct.brand,
            priceMin: focusProduct.priceMin,
            styleKeywords: focusProduct.styleKeywords,
            category: focusProduct.category,
          }
        : undefined;

      const res = await fetch("/api/stylist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: text.trim(),
          conversationHistory,
          currentOutfit,
          surface,
          ...(focusOutfitPiece && { focusProduct: focusOutfitPiece }),
          ...(browseContext && { browseContext }),
        }),
      });

      if (res.status === 429) {
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          text: "You're sending messages too fast — wait a moment and try again.",
          isError: true,
        }]);
        return;
      }

      if (res.status === 501) {
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          text: "AI Stylist isn't set up yet. An admin needs to add an OpenAI API key in Settings.",
          isError: true,
        }]);
        return;
      }

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const json = await res.json();

      // Resolve suggestedProductIds → full Product objects using the in-memory catalog.
      const suggestedProducts: Product[] = (json.suggestedProductIds as string[] ?? [])
        .map((id: string) => products.find(p => p.id === id))
        .filter((p): p is Product => p != null);

      // Fall back to styleKeyword filtering if no IDs were resolved.
      const finalSuggestions: Product[] =
        suggestedProducts.length > 0
          ? suggestedProducts
          : (json.styleKeywords as string[] ?? []).length > 0
          ? products
              .filter(p => (json.styleKeywords as string[]).some(kw => (p.styleKeywords as string[]).includes(kw)))
              .slice(0, 4)
          : [];

      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        text: json.reply ?? "Here are some options that might work for your look.",
        suggestions: finalSuggestions.length > 0 ? finalSuggestions : undefined,
      }]);
    } catch {
      setChatMessages(prev => [...prev, {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        text: "Something went wrong. Please try again.",
        isError: true,
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  if (!isOpen) return null;

  // Position classes differ between builder (absolute within a relative container)
  // and product/browse pages (fixed to viewport, below the h-16 site nav).
  const positionClasses = position === "absolute"
    ? "absolute top-0 right-0 bottom-0 z-20"
    : "fixed top-16 right-0 bottom-0 z-40";

  const quickReplies = QUICK_REPLIES[surface];

  return (
    <div
      className={`${positionClasses} w-full md:w-[380px] bg-[var(--background)] border-l border-[var(--border-strong)] flex flex-col animate-slide-in-right`}
      style={{ boxShadow: "-20px 0 60px rgba(0,0,0,0.12)" }}
    >
      {/* Drawer header */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center font-display text-[13px] font-medium italic">
            G
          </div>
          <div>
            <p className="text-[13px] font-medium text-[var(--foreground)]">Stylist</p>
            <p className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-subtle)]">
              ● Online
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors text-xl leading-none"
          aria-label="Close stylist"
        >
          ×
        </button>
      </div>

      {/* Chat thread */}
      <div
        ref={chatThreadRef}
        className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 min-h-0"
      >
        {chatMessages.map(msg => (
          <div
            key={msg.id}
            className={`flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {/* Bubble */}
            <div
              className={`max-w-[88%] px-3.5 py-2.5 text-[12px] leading-relaxed ${
                msg.role === "user"
                  ? "bg-[var(--foreground)] text-[var(--background)] rounded-xl rounded-br-sm"
                  : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-xl rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>

            {/* Suggestion strip — only rendered when there are actual products */}
            {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 w-full" style={{ scrollbarWidth: "none" }}>
                {msg.suggestions.map(product => {
                  // Selected state: true if this product is already in the builder selection.
                  const isSelected = Object.values(selection ?? {}).some(p => p?.id === product.id);

                  const cardInner = (
                    <>
                      <div className="w-[72px] aspect-[3/4] overflow-hidden bg-[var(--surface)] border border-[var(--border)] group-hover:border-[var(--foreground)] transition-colors relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        {isSelected && (
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[var(--foreground)] flex items-center justify-center">
                            <svg width="7" height="5" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3.5 6L8 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <p className="font-mono text-[8px] tracking-[0.06em] text-[var(--foreground-muted)] mt-1 truncate w-full text-left leading-none">
                        {product.brand}
                      </p>
                      <p className="font-mono text-[9px] text-[var(--foreground)] truncate w-full text-left leading-tight mt-0.5">
                        ${product.priceMin.toLocaleString()}
                      </p>
                    </>
                  );

                  // Builder: tap card → add to canvas via onSelectProduct.
                  // Other surfaces: tap card → navigate to product detail page.
                  return onSelectProduct ? (
                    <button
                      key={product.id}
                      onClick={() => onSelectProduct(product)}
                      className="shrink-0 flex flex-col group"
                      style={{ width: 72 }}
                    >
                      {cardInner}
                    </button>
                  ) : (
                    <Link
                      key={product.id}
                      href={`/product/${product.id}`}
                      className="shrink-0 flex flex-col group"
                      style={{ width: 72 }}
                    >
                      {cardInner}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {chatLoading && (
          <div className="flex items-start">
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              {[0, 150, 300].map(delay => (
                <span
                  key={delay}
                  className="w-1.5 h-1.5 rounded-full bg-[var(--foreground-muted)] animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick-reply chips */}
      <div className="px-4 pb-2.5 shrink-0 flex gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {quickReplies.map(reply => (
          <button
            key={reply}
            onClick={() => sendMessage(reply)}
            disabled={chatLoading}
            className="shrink-0 px-3 py-1 rounded-full border border-[var(--border-strong)] font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Composer */}
      <div className="px-4 pb-4 shrink-0 border-t border-[var(--border)] pt-3">
        <div className={`flex items-center border transition-colors duration-150 ${
          chatLoading ? "border-[var(--border)] opacity-60" : "border-[var(--border-strong)] focus-within:border-[var(--foreground)]"
        }`}>
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput); } }}
            placeholder="Message stylist…"
            maxLength={500}
            disabled={chatLoading}
            className="flex-1 h-10 bg-transparent outline-none px-3 text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] disabled:cursor-not-allowed"
          />
          <button
            onClick={() => sendMessage(chatInput)}
            disabled={!chatInput.trim() || chatLoading}
            className="w-10 h-10 flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            aria-label="Send"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M14 8L2 2L5 8L2 14L14 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        <p className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--foreground-subtle)] mt-1.5 text-right">
          ⏎ to send
        </p>
      </div>
    </div>
  );
}
