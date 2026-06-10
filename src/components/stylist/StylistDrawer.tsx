"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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

// ── Text helpers ──────────────────────────────────────────────────────────────

function cleanReplyText(text: string): string {
  return text
    // Strip leftover JSON blocks (fenced or bare) first
    .replace(/```json[\s\S]*?```/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\{[^{}]*"suggestedProductIds"[^{}]*\}/g, "")
    // Strip trailing announcements like "Here's the JSON block:" (EN + RU)
    .replace(/(here'?s|here is)\s+(the\s+)?json\s*(block|data)?\s*:?\s*$/gim, "")
    .replace(/вот\s+(json|джсон)[^\n]*:?\s*$/gim, "")
    // Strip stray "**Suggested ProductIds:** [...]" / "**StyleKeywords:** [...]"
    .replace(/\*?\*?Suggested\s*Product\s*Ids?\*?\*?\s*:?\s*\[[^\]]*\]/gi, "")
    .replace(/\*?\*?Style\s*Keywords?\*?\*?\s*:?\s*\[[^\]]*\]/gi, "")
    // Strip any remaining UUID-like strings
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    // Collapse 3+ newlines and trailing whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  return lines.map((line, li) => {
    // Replace **text** with <strong>
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const nodes = parts.map((part, pi) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={pi}>{part.slice(2, -2)}</strong>;
      }
      return <span key={pi}>{part}</span>;
    });
    return (
      <span key={li}>
        {nodes}
        {li < lines.length - 1 && <br />}
      </span>
    );
  });
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === "undefined") return [makeWelcome(focusProduct)];
    try {
      const stored = sessionStorage.getItem("stylist_chat_v1");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [makeWelcome(focusProduct)];
  });
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const { formatPrice } = useCurrency();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const chatThreadRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Escape closes the drawer; Tab cycles focus inside it (focus trap).
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !drawerRef.current) return;
      const focusables = drawerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      // Pull focus into the drawer on first Tab, then keep it cycling inside
      if (!drawerRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/stylist/usage")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.remaining !== undefined) setRemaining(data.remaining as number | null);
        if (data.limit !== undefined) setDailyLimit(data.limit as number | null);
      })
      .catch(() => {});
  }, [isOpen]);
  const chipsRef = useRef<HTMLDivElement>(null);
  const chipsDrag = useRef({ active: false, startX: 0, scrollLeft: 0 });

  const onChipsMouseDown = useCallback((e: React.MouseEvent) => {
    const el = chipsRef.current;
    if (!el) return;
    chipsDrag.current = { active: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft };
    el.style.cursor = "grabbing";
  }, []);

  const onChipsMouseMove = useCallback((e: React.MouseEvent) => {
    const el = chipsRef.current;
    if (!el || !chipsDrag.current.active) return;
    e.preventDefault();
    el.scrollLeft = chipsDrag.current.scrollLeft - (e.pageX - el.offsetLeft - chipsDrag.current.startX);
  }, []);

  const onChipsMouseUp = useCallback(() => {
    chipsDrag.current.active = false;
    if (chipsRef.current) chipsRef.current.style.cursor = "grab";
  }, []);

  const contextId = focusProduct?.id ?? "";

  const startNewChat = () => {
    const fresh = [makeWelcome(focusProduct)];
    setChatMessages(fresh);
    setChatInput("");
    setView("chat");
    try { sessionStorage.removeItem("stylist_chat_v1"); } catch {}
  };

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

  // Persist messages to sessionStorage so chat survives page navigation
  useEffect(() => {
    try { sessionStorage.setItem("stylist_chat_v1", JSON.stringify(chatMessages)); } catch {}
  }, [chatMessages]);

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
          text: "AI Stylist isn't set up yet. An admin needs to configure the AI provider token.",
          isError: true,
        }]);
        return;
      }

      if (!res.ok) throw new Error(`Request failed: ${res.status}`);

      // Update usage counters
      if (json.remaining !== undefined) setRemaining(json.remaining as number | null);
      if (json.limit !== undefined) setDailyLimit(json.limit as number | null);

      // Prefer full product data returned by the API (includes imageUrl, currency for
      // products that may not be in the local `products` prop list).
      // Fall back to local lookup for backwards compatibility.
      type ApiProduct = { id: string; name: string; brand: string; category: string; priceMin: number; currency: string; imageUrl: string; styleKeywords: string[] };
      const apiProducts: ApiProduct[] = Array.isArray(json.suggestedProducts) ? json.suggestedProducts : [];
      let finalSuggestions: Product[];
      if (apiProducts.length > 0) {
        finalSuggestions = apiProducts.map(ap => {
          const local = products.find(p => p.id === ap.id);
          if (local) return local;
          return {
            id: ap.id, name: ap.name, brand: ap.brand as Product["brand"],
            category: ap.category as Product["category"],
            priceMin: ap.priceMin, priceMax: ap.priceMin,
            currency: ap.currency, imageUrl: ap.imageUrl, images: [ap.imageUrl],
            styleKeywords: ap.styleKeywords as Product["styleKeywords"],
            description: "", colors: [], sizes: [], material: "",
            retailers: [], isNew: false, isSaved: false,
          } as Product;
        });
      } else {
        // Fallback: look up by ID from props
        const byId = (json.suggestedProductIds as string[] ?? [])
          .map((id: string) => products.find(p => p.id === id))
          .filter((p): p is Product => p != null);
        const keywords = (json.styleKeywords as string[] ?? []);
        finalSuggestions = byId.length > 0
          ? byId
          : keywords.length > 0
            ? products.filter(p => keywords.some(kw => (p.styleKeywords as string[] ?? []).includes(kw))).slice(0, 6)
            : [];
      }

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
    ? "absolute top-0 right-0 bottom-0 z-20 w-full md:w-[380px]"
    : "fixed bottom-14 left-0 right-0 z-[60] w-full h-[58vh] rounded-t-2xl md:top-[72px] md:bottom-[88px] md:left-auto md:right-4 md:w-[380px] md:h-auto md:rounded-2xl md:overflow-hidden";

  const quickReplies = QUICK_REPLIES[surface];

  const showUsage = dailyLimit !== null && remaining !== null;
  const usageWarning = showUsage && remaining <= 5;
  const pctLeft = showUsage ? Math.round((remaining! / dailyLimit!) * 100) : 100;

  return (
    <>
      {/* Mobile backdrop */}
      {position === "fixed" && (
        <div
          className="md:hidden fixed inset-0 z-[55] bg-black/40"
          style={{ animation: "overlayIn 0.2s ease forwards" }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}
    <div
      ref={drawerRef}
      role="dialog"
      aria-modal={position === "fixed"}
      aria-label="AI Stylist chat"
      className={`${positionClasses} bg-[var(--background)] border-t border-[var(--border-strong)] md:border md:border-[var(--border-strong)] flex flex-col stylist-drawer-animate`}
      style={{ boxShadow: position === "fixed" ? "0 8px 40px rgba(0,0,0,0.22), 0 2px 12px rgba(0,0,0,0.12)" : undefined }}
    >
      {/* Mobile drag handle */}
      {position === "fixed" && (
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-[var(--border-strong)]" />
        </div>
      )}
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-5 py-4 border-b border-[var(--border)] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center justify-center text-[14px] font-bold">
            G
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[var(--foreground)]">Stylist</p>
            <p className="text-[10px] text-[var(--foreground-subtle)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Online
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* New chat button */}
          <button
            onClick={startNewChat}
            title="New chat"
            aria-label="New chat"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-all"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 1H3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7" />
              <path d="M11 1l2 2-5 5H6V6l5-5Z" />
            </svg>
          </button>
          {/* History icon toggle */}
          <button
            onClick={view === "history" ? () => setView("chat") : switchToHistory}
            title={view === "history" ? "Back to chat" : "Chat history"}
            aria-label={view === "history" ? "Back to chat" : "Chat history"}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
              view === "history"
                ? "text-[var(--foreground)] bg-[var(--fg-overlay-05)]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)]"
            }`}
          >
            {view === "history" ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2L4 7L9 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="5.5" />
                <path d="M7 4.5V7l1.5 1.5" />
              </svg>
            )}
          </button>
          <button
            onClick={onClose}
            aria-label="Close stylist"
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--foreground-muted)] hover:text-[var(--foreground)] hover:bg-[var(--fg-overlay-05)] transition-all text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Usage bar ─────────────────────────────────────────────────────── */}
      {showUsage && (
        <div className="px-5 py-2.5 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[8px] tracking-[0.1em] uppercase text-[var(--foreground-muted)]">
              Daily limit
            </span>
            <span className={`font-mono text-[8px] tracking-[0.08em] ${usageWarning ? "text-amber-500" : "text-[var(--foreground-subtle)]"}`}>
              {pctLeft}% remaining
              {usageWarning && remaining! > 0 && (
                <Link href="/plans" className="ml-2 underline hover:no-underline">
                  Upgrade
                </Link>
              )}
            </span>
          </div>
          <div className="h-[2px] bg-[var(--border)] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pctLeft > 50
                  ? "bg-[var(--foreground)]"
                  : pctLeft > 20
                  ? "bg-amber-400"
                  : "bg-red-400"
              }`}
              style={{ width: `${pctLeft}%` }}
            />
          </div>
        </div>
      )}

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
                    className="w-full text-left px-3 py-3 rounded-xl border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface)] transition-colors group"
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
                  className={`max-w-[88%] px-4 py-2.5 text-[12px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--foreground)] text-[var(--background)] rounded-2xl rounded-br-sm"
                      : msg.isError
                      ? "bg-red-500/8 border border-red-400/30 text-[var(--foreground)] rounded-2xl rounded-bl-sm"
                      : "bg-[var(--surface)] border border-[var(--border)] text-[var(--foreground)] rounded-2xl rounded-bl-sm"
                  }`}
                >
                  {msg.role === "assistant" && !msg.isError
                    ? renderMarkdown(cleanReplyText(msg.text))
                    : msg.text}
                </div>

                {/* Suggestion strip */}
                {msg.role === "assistant" && msg.suggestions && msg.suggestions.length > 0 && (
                  <div className="w-full flex flex-col gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {msg.suggestions.map(product => {
                        const isSelected = Object.values(selection ?? {}).some(p => p?.id === product.id);
                        const cardInner = (
                          <>
                            <div className="w-[72px] aspect-[3/4] overflow-hidden bg-[var(--surface)] border border-[var(--border)] group-hover:border-[var(--foreground)] transition-colors relative rounded-xl">
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
                              {formatPrice(product.priceMin, product.currency)}
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

                    {/* Build this look button — shown whenever suggestions map to a builder slot */}
                    {(() => {
                      const url = buildLookUrl(msg.suggestions);
                      const slots = new Set(msg.suggestions.map(p => CATEGORY_TO_SLOT[p.category]).filter(Boolean));
                      return slots.size >= 1 ? (
                        <Link
                          href={url}
                          className="inline-flex items-center gap-1.5 self-start border border-[var(--foreground)] text-[var(--foreground)] px-3 py-1.5 rounded-full font-mono text-[9px] tracking-[0.12em] uppercase hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
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
                <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
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
          <div
            ref={chipsRef}
            className="px-4 py-3 shrink-0 flex gap-2 overflow-x-auto select-none"
            style={{ scrollbarWidth: "none", cursor: "grab" }}
            onMouseDown={onChipsMouseDown}
            onMouseMove={onChipsMouseMove}
            onMouseUp={onChipsMouseUp}
            onMouseLeave={onChipsMouseUp}
          >
            {quickReplies.map(reply => (
              <button
                key={reply}
                onClick={() => !chipsDrag.current.active && sendMessage(reply)}
                disabled={chatLoading}
                className="shrink-0 px-3.5 py-1.5 rounded-full border border-[var(--border-strong)] text-[10px] tracking-wide text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {reply}
              </button>
            ))}
          </div>

          {/* Composer */}
          <div className="px-4 pb-4 pt-2 shrink-0 border-t border-[var(--border)]">
            <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 transition-colors duration-150 ${
              chatLoading ? "border-[var(--border)] opacity-60" : "border-[var(--border-strong)] focus-within:border-[var(--foreground)]"
            }`}>
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput); } }}
                placeholder="Ask your stylist…"
                maxLength={500}
                disabled={chatLoading}
                className="flex-1 h-8 bg-transparent outline-none text-base md:text-[12px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] disabled:cursor-not-allowed"
              />
              <button
                onClick={() => sendMessage(chatInput)}
                disabled={!chatInput.trim() || chatLoading}
                aria-label="Send"
                className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--foreground)] text-[var(--background)] shrink-0 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M14 8L2 2L5 8L2 14L14 8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
    </>
  );
}
