"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { Product } from "@/lib/types";
import { useCurrency } from "@/lib/context/currency-context";
import type { ChatSession } from "@/app/api/stylist/chat/sessions/route";

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

// ── Builder URL builder ───────────────────────────────────────────────────────

const CATEGORY_TO_SLOT: Record<string, string> = {
  outerwear: "outerwear",
  tops: "top",
  knitwear: "top",
  bottoms: "bottom",
  dresses: "bottom",
  footwear: "shoes",
  accessories: "accessories",
};

function buildLookUrl(products: Product[]): string {
  const params: string[] = [];
  const used = new Set<string>();
  for (const p of products) {
    const slot = CATEGORY_TO_SLOT[p.category];
    if (slot && !used.has(slot)) {
      params.push(`${slot}=${p.id}`);
      used.add(slot);
    }
  }
  return params.length > 0 ? `/builder?${params.join("&")}` : "/builder";
}

// ── Quick replies ─────────────────────────────────────────────────────────────

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

// ── Session label ─────────────────────────────────────────────────────────────

function sessionLabel(s: ChatSession): string {
  const labels: Record<string, string> = { builder: "Builder", browse: "Browse", product: "Product" };
  return labels[s.surface] ?? s.surface;
}

function relativeDate(iso: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Props ─────────────────────────────────────────────────────────────────────

export interface StylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  surface: "builder" | "browse" | "product";
  products: Product[];
  position?: "fixed" | "absolute";
  selection?: Partial<Record<string, Product>>;
  onSelectProduct?: (product: Product) => void;
  focusProduct?: Product;
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
  const [view, setView] = useState<"chat" | "history">("chat");
  const { formatPrice } = useCurrency();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const chatThreadRef = useRef<HTMLDivElement>(null);

  const contextId = focusProduct?.id ?? "";

  // Load chat history when drawer opens
  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/stylist/chat/history?surface=${encodeURIComponent(surface)}&context_id=${encodeURIComponent(contextId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          setChatMessages([makeWelcome(focusProduct), ...data.messages]);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Load chat sessions for history panel
  const loadSessions = () => {
    if (sessionsLoading) return;
    setSessionsLoading(true);
    fetch("/api/stylist/chat/sessions")
      .then(r => r.ok ? r.json() : { sessions: [] })
      .then(data => setSessions(Array.isArray(data.sessions) ? data.sessions : []))
      .catch(() => setSessions([]))
      .finally(() => setSessionsLoading(false));
  };

  const switchToHistory = () => {
    setView("history");
    loadSessions();
  };

  // Load a past session into the chat view
  const loadSession = (s: ChatSession) => {
    fetch(`/api/stylist/chat/history?surface=${encodeURIComponent(s.surface)}&context_id=${encodeURIComponent(s.contextId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          // Hydrate suggestions from products list
          const hydrated: ChatMessage[] = data.messages.map((m: ChatMessage) => {
            if (m.role === "assistant" && Array.isArray(m.suggestions)) {
              return {
                ...m,
                suggestions: (m.suggestions as unknown as string[])
                  .map((id: string) => products.find(p => p.id === id))
                  .filter((p): p is Product => p != null),
              };
            }
            return m;
          });
          setChatMessages([makeWelcome(focusProduct), ...hydrated]);
        }
        setView("chat");
      })
      .catch(() => setView("chat"));
  };

  // Persist history after each AI reply
  const saveHistory = (messages: ChatMessage[]) => {
    const toSave = messages.filter(m => m.id !== "welcome" && !m.isError);
    if (toSave.length === 0) return;
    fetch("/api/stylist/chat/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface, context_id: contextId, messages: toSave }),
    }).catch(() => {});
  };

  // Auto-scroll
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
      const conversationHistory = chatMessages
        .filter(m => m.id !== "welcome" && !m.isError)
        .map(m => ({ role: m.role as "user" | "assistant", content: m.text }))
        .slice(-20);

      const currentOutfit: Record<string, OutfitPiece> = selection
        ? Object.fromEntries(
            Object.entries(selection)
              .filter(([, p]) => p != null)
              .map(([slot, p]) => [slot, {
                slot, productId: p!.id, name: p!.name, brand: p!.brand,
                priceMin: p!.priceMin, styleKeywords: p!.styleKeywords, category: p!.category,
              }])
          )
        : {};

      const focusOutfitPiece: OutfitPiece | undefined = focusProduct
        ? { slot: "focus", productId: focusProduct.id, name: focusProduct.name,
            brand: focusProduct.brand, priceMin: focusProduct.priceMin,
            styleKeywords: focusProduct.styleKeywords, category: focusProduct.category }
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

      const json = await res.json();

      if (res.status === 429) {
        setChatMessages(prev => [...prev, {
          id: `msg-${Date.now()}-ai`,
          role: "assistant",
          text: json.error ?? "You've reached your daily message limit. Upgrade for more.",
          isError: true,
        }]);
        if (json.remaining !== undefined) setRemaining(json.remaining as number);
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

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      // Update usage counters
      if (json.remaining !== undefined) setRemaining(json.remaining as number | null);
      if (json.limit !== undefined) setDailyLimit(json.limit as number | null);

      // Resolve product IDs
      const suggestedProducts: Product[] = (json.suggestedProductIds as string[] ?? [])
        .map((id: string) => products.find(p => p.id === id))
        .filter((p): p is Product => p != null);

      const finalSuggestions: Product[] =
        suggestedProducts.length > 0
          ? suggestedProducts
          : (json.styleKeywords as string[] ?? []).length > 0
          ? products
              .filter(p => (json.styleKeywords as string[]).some(kw => (p.styleKeywords as string[]).includes(kw)))
              .slice(0, 4)
          : [];

      const aiMsg: ChatMessage = {
        id: `msg-${Date.now()}-ai`,
        role: "assistant",
        text: json.reply ?? "Here are some options that might work.",
        suggestions: finalSuggestions.length > 0 ? finalSuggestions : undefined,
      };
      setChatMessages(prev => [...prev, aiMsg]);
      saveHistory([...chatMessages.filter(m => m.id !== "welcome" && !m.isError), userMsg, aiMsg]);
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

  const positionClasses = position === "absolute"
    ? "absolute top-0 right-0 bottom-0 z-20"
    : "fixed top-16 right-0 bottom-0 z-40";

  const quickReplies = QUICK_REPLIES[surface];

  // ── Remaining messages footer ─────────────────────────────────────────────
  const showUsage = dailyLimit !== null && remaining !== null;
  const usageWarning = showUsage && remaining <= 5;

  return (
    <>
    <div
      className={`${positionClasses} w-full md:w-[380px] bg-[var(--background)] border-l border-[var(--border-strong)] flex flex-col animate-slide-in-right`}
      style={{ boxShadow: "-20px 0 60px rgba(0,0,0,0.12)" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
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

        <div className="flex items-center gap-3">
          {/* History tab toggle */}
          <button
            onClick={view === "history" ? () => setView("chat") : switchToHistory}
            className={`font-mono text-[9px] tracking-[0.12em] uppercase transition-colors ${
              view === "history"
                ? "text-[var(--foreground)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {view === "history" ? "← Chat" : "History"}
          </button>
          <button
            onClick={onClose}
            className="text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors text-xl leading-none"
            aria-label="Close stylist"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── History panel ─────────────────────────────────────────────────── */}
      {view === "history" && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-5 pt-4 pb-2">
            <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-muted)] mb-4">
              Past conversations
            </p>
            {sessionsLoading ? (
              <p className="text-xs text-[var(--foreground-subtle)] text-center py-8">Loading…</p>
            ) : sessions.length === 0 ? (
              <p className="text-xs text-[var(--foreground-subtle)] text-center py-8">
                No saved conversations yet.
              </p>
            ) : (
              <div className="flex flex-col gap-px">
                {sessions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => loadSession(s)}
                    className="w-full text-left px-3 py-3 border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors">
                        {sessionLabel(s)}
                      </span>
                      <span className="font-mono text-[8px] text-[var(--foreground-subtle)]">
                        {relativeDate(s.updatedAt)}
                      </span>
                    </div>
                    {s.lastText && (
                      <p className="text-[11px] text-[var(--foreground)] line-clamp-2 leading-snug">
                        {s.lastRole === "user" ? "You: " : ""}{s.lastText}
                      </p>
                    )}
                    <p className="text-[9px] text-[var(--foreground-subtle)] mt-1">
                      {s.messageCount} {s.messageCount === 1 ? "message" : "messages"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Chat view ─────────────────────────────────────────────────────── */}
      {view === "chat" && (
        <>
          {/* Thread */}
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
                      : msg.isError
                      ? "bg-red-500/8 border border-red-400/30 text-[var(--foreground)] rounded-xl rounded-bl-sm"
                      : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-xl rounded-bl-sm"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Suggestion strip */}
                {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {msg.suggestions.map(product => {
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
                              {formatPrice(product.priceMin)}
                            </p>
                          </>
                        );

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

                    {/* Build this look button — shown when 2+ suggestions span different slots */}
                    {(() => {
                      const url = buildLookUrl(msg.suggestions);
                      const slots = new Set(msg.suggestions.map(p => CATEGORY_TO_SLOT[p.category]).filter(Boolean));
                      return slots.size >= 2 ? (
                        <Link
                          href={url}
                          className="inline-flex items-center gap-1.5 self-start border border-[var(--foreground)] text-[var(--foreground)] px-3 py-1.5 font-mono text-[9px] tracking-[0.12em] uppercase hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
                        >
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                            <path d="M2 2H10V10M2 10L10 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                          </svg>
                          Build this look
                        </Link>
                      ) : null;
                    })()}
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
          <div className="px-4 pb-3 shrink-0 border-t border-[var(--border)] pt-3">
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

            {/* Usage counter */}
            <div className="flex items-center justify-between mt-1.5">
              <p className="font-mono text-[8px] tracking-[0.08em] uppercase text-[var(--foreground-subtle)]">
                ⏎ to send
              </p>
              {showUsage && (
                <p className={`font-mono text-[8px] tracking-[0.08em] uppercase ${usageWarning ? "text-amber-500" : "text-[var(--foreground-subtle)]"}`}>
                  {remaining} / {dailyLimit} messages left today
                  {usageWarning && remaining > 0 && (
                    <Link href="/plans" className="ml-1.5 underline hover:no-underline">
                      Upgrade
                    </Link>
                  )}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
