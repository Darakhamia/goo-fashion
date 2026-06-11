"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";

import { useAuth } from "@/lib/context/auth-context";
import { useTheme, type ThemePreference } from "@/lib/context/theme-context";
import { useCurrency, CURRENCIES, type CurrencyCode } from "@/lib/context/currency-context";
import Link from "next/link";
import { PLANS, PLAN_ORDER, planPriceDual, type PlanId } from "@/lib/plans";
import { StylistPersonalizationModal, LIFESTYLE_OPTIONS as LIFESTYLE_OPTIONS_IMPORT, type StylistPersonalization } from "@/components/stylist/StylistPersonalizationModal";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "account" | "settings" | "plan" | "stylist";
type BodyType = "slim" | "athletic" | "average" | "curvy" | "petite" | "tall";
type StyleKeyword =
  | "minimal" | "classic" | "streetwear" | "sporty" | "avant-garde"
  | "romantic" | "utilitarian" | "bohemian" | "preppy" | "dark"
  | "maximalist" | "coastal" | "academic";

interface StylePreferences {
  bodyType: BodyType | null;
  budget: string | null;
  selectedColors: string[];
  selectedStyles: StyleKeyword[];
  sizes: { tops: string; bottoms: string; shoes: string; dresses: string };
}

const LIFESTYLE_OPTIONS = LIFESTYLE_OPTIONS_IMPORT;

// ── Static data ────────────────────────────────────────────────────────────────
const BODY_TYPES: { id: BodyType; label: string; description: string }[] = [
  { id: "slim", label: "Slim", description: "Lean, long proportions" },
  { id: "athletic", label: "Athletic", description: "Muscular, balanced frame" },
  { id: "average", label: "Average", description: "Balanced proportions" },
  { id: "curvy", label: "Curvy", description: "Defined waist, fuller frame" },
  { id: "petite", label: "Petite", description: "Compact, shorter frame" },
  { id: "tall", label: "Tall", description: "Elongated proportions" },
];

const STYLE_KEYWORDS: StyleKeyword[] = [
  "minimal", "classic", "streetwear", "sporty", "avant-garde",
  "romantic", "utilitarian", "bohemian", "preppy", "dark",
  "maximalist", "coastal", "academic",
];

const COLOR_PALETTE = [
  { name: "Ivory", hex: "#F5F0E8", light: true },
  { name: "Cream", hex: "#FFFDD0", light: true },
  { name: "Sand", hex: "#C8B89A", light: true },
  { name: "Blush", hex: "#E8B4A0", light: true },
  { name: "Camel", hex: "#C19A6B", light: false },
  { name: "Terracotta", hex: "#C0604A", light: false },
  { name: "Burgundy", hex: "#722F37", light: false },
  { name: "Stone", hex: "#928E85", light: false },
  { name: "Slate", hex: "#708090", light: false },
  { name: "Olive", hex: "#6B6B47", light: false },
  { name: "Forest", hex: "#2D4A2D", light: false },
  { name: "Navy", hex: "#1B2A4A", light: false },
  { name: "Cobalt", hex: "#0047AB", light: false },
  { name: "Charcoal", hex: "#36454F", light: false },
  { name: "Chocolate", hex: "#5C3D2E", light: false },
  { name: "Midnight", hex: "#0A0A0A", light: false },
];

const BUDGET_OPTIONS = [
  { label: "Entry", range: "$100–400" },
  { label: "Mid", range: "$400–900" },
  { label: "Premium", range: "$900–2000" },
  { label: "Luxury", range: "$2000+" },
];


const PLAN_FEATURE_LABELS: Record<string, string> = {
  aiStylist: "AI Stylist chat",
  imageGeneration: "Outfit image generation",
  saveOutfits: "Save outfits",
  stylistMemory: "Stylist memory",
  exclusiveStyles: "Exclusive styles",
};

const ALL_FEATURES = ["aiStylist", "imageGeneration", "saveOutfits", "stylistMemory", "exclusiveStyles"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

interface BillingStatus {
  plan: PlanId;
  status: "pending" | "active" | "past_due" | "canceled";
  amount: number;
  ccy: number;
  autoRenew: boolean;
  currentPeriodEnd: string | null;
  maskedPan: string | null;
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();

  const [activeTab, setActiveTab] = useState<Tab>("account");

  // Style preferences
  const [bodyType, setBodyType] = useState<BodyType | null>(null);
  const [budget, setBudget] = useState<string | null>(null);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<StyleKeyword[]>([]);
  const [sizes, setSizes] = useState({ tops: "", bottoms: "", shoes: "", dresses: "" });
  const [styleSaved, setStyleSaved] = useState(false);
  const [styleSaving, setStyleSaving] = useState(false);

  // AI Stylist personalization
  const [stylistPersonalization, setStylistPersonalization] = useState<StylistPersonalization | null>(null);
  const [showStylistModal, setShowStylistModal] = useState(false);

  // Hydrate from Clerk unsafeMetadata
  useEffect(() => {
    if (!clerkUser || !isLoaded) return;
    const meta = clerkUser.unsafeMetadata as {
      stylePreferences?: StylePreferences;
      stylistPersonalization?: StylistPersonalization;
    };
    if (meta.stylePreferences) {
      const p = meta.stylePreferences;
      setBodyType(p.bodyType ?? null);
      setBudget(p.budget ?? null);
      setSelectedColors(p.selectedColors ?? []);
      setSelectedStyles((p.selectedStyles ?? []) as StyleKeyword[]);
      setSizes(p.sizes ?? { tops: "", bottoms: "", shoes: "", dresses: "" });
    }
    if (meta.stylistPersonalization) {
      setStylistPersonalization(meta.stylistPersonalization);
    }
  }, [clerkUser, isLoaded]);

  const saveStylePreferences = async () => {
    if (!clerkUser) return;
    setStyleSaving(true);
    try {
      await clerkUser.update({
        unsafeMetadata: {
          ...clerkUser.unsafeMetadata,
          stylePreferences: { bodyType, budget, selectedColors, selectedStyles, sizes },
        },
      });
      setStyleSaved(true);
      setTimeout(() => setStyleSaved(false), 3000);
    } finally {
      setStyleSaving(false);
    }
  };

  const saveStylistPersonalization = async (data: StylistPersonalization) => {
    if (!clerkUser) return;
    await clerkUser.update({
      unsafeMetadata: {
        ...clerkUser.unsafeMetadata,
        stylistPersonalization: data,
      },
    });
    setStylistPersonalization(data);
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "account", label: "Account" },
    { id: "settings", label: "Settings" },
    { id: "plan", label: "Plan" },
    { id: "stylist", label: "AI Stylist" },
  ];

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-4 h-4 border border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16">

          {/* Header */}
          <div className="mb-10 animate-fade-up">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Profile
            </p>
            <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)]">
              {user?.name ?? "Your profile."}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 mb-10 w-fit bg-[var(--surface)] rounded-full p-1 border border-[var(--border)] overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="relative px-5 py-2 text-[10px] tracking-[0.16em] uppercase font-medium rounded-full whitespace-nowrap z-10 transition-colors duration-200"
                style={{ color: activeTab === tab.id ? "var(--background)" : "var(--foreground-muted)" }}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="profile-tab-pill"
                    className="absolute inset-0 rounded-full bg-[var(--foreground)]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    style={{ zIndex: -1 }}
                  />
                )}
                {tab.label}
                {tab.id === "stylist" && stylistPersonalization && (
                  <span className="ml-2 w-1.5 h-1.5 rounded-full bg-current inline-block align-middle" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="max-w-2xl pb-20"
            >
              {activeTab === "account" && (
                <AccountTab user={user} clerkUser={clerkUser} onOpenSettings={() => setActiveTab("settings")} />
              )}
              {activeTab === "settings" && <SettingsTab />}
              {activeTab === "plan" && (
                <PlanTab currentPlan={user?.plan ?? "free"} />
              )}
              {activeTab === "stylist" && (
                <StylistTab
                  personalization={stylistPersonalization}
                  onCustomize={() => setShowStylistModal(true)}
                  bodyType={bodyType}
                  setBodyType={setBodyType}
                  budget={budget}
                  setBudget={setBudget}
                  selectedColors={selectedColors}
                  setSelectedColors={setSelectedColors}
                  selectedStyles={selectedStyles}
                  setSelectedStyles={setSelectedStyles}
                  sizes={sizes}
                  setSizes={setSizes}
                  onSaveStyle={saveStylePreferences}
                  styleSaved={styleSaved}
                  styleSaving={styleSaving}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showStylistModal && (
        <StylistPersonalizationModal
          initial={stylistPersonalization}
          userName={user?.name?.split(" ")[0] ?? ""}
          onClose={() => setShowStylistModal(false)}
          onSave={async (data) => {
            await saveStylistPersonalization(data);
            setShowStylistModal(false);
          }}
        />
      )}
    </div>
  );
}

// ── Account Tab ────────────────────────────────────────────────────────────────
function AccountTab({
  user,
  clerkUser,
  onOpenSettings,
}: {
  user: { name: string; email: string; plan: PlanId; avatar?: string; joinedAt: string } | null;
  clerkUser: ReturnType<typeof useUser>["user"];
  onOpenSettings: () => void;
}) {
  const { logout } = useAuth();

  return (
    <div className="animate-fade-up space-y-10">
      {/* Identity */}
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--surface)] shrink-0 flex items-center justify-center border border-[var(--border)]">
          {clerkUser?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={clerkUser.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-light text-[var(--foreground-muted)]">
              {user?.name?.[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </div>
        <div>
          <p className="text-lg font-medium text-[var(--foreground)]">{user?.name}</p>
          <p className="text-sm text-[var(--foreground-muted)]">{user?.email}</p>
          <p className="text-xs text-[var(--foreground-subtle)] mt-1">
            Member since {user?.joinedAt?.slice(0, 7)}
          </p>
        </div>
      </div>

      {/* Plan badge */}
      <div className="p-4 border border-[var(--border)] rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--foreground)]" />
          <p className="text-xs text-[var(--foreground-muted)]">
            You are on the{" "}
            <span className="text-[var(--foreground)] font-medium capitalize">{user?.plan ?? "free"} plan</span>
          </p>
        </div>
        <Link
          href="/plans"
          className="text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--foreground)] hover:opacity-60 transition-opacity"
        >
          {user?.plan === "free" ? "Upgrade" : "Manage"}
        </Link>
      </div>

      {/* Personalization shortcut */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
          Personalization
        </p>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-between p-5 border border-[var(--border)] rounded-xl hover:border-[var(--border-strong)] transition-colors duration-200 text-left"
        >
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Settings</p>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              Theme and currency preferences
            </p>
          </div>
          <span className="text-[var(--foreground-subtle)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
      </div>

      {/* Session */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
          Session
        </p>
        <button
          onClick={logout}
          className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] rounded-xl px-6 py-3 hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Settings Tab ───────────────────────────────────────────────────────────────
const THEME_OPTIONS: { id: ThemePreference; label: string; description: string; icon: React.ReactNode }[] = [
  {
    id: "light",
    label: "Light",
    description: "Bright interface",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark",
    description: "Easy on the eyes",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "system",
    label: "System",
    description: "Match your device",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

function SettingsTab() {
  const { preference, setPreference, theme } = useTheme();
  const { currency, setCurrency, formatPrice } = useCurrency();

  return (
    <div className="animate-fade-up space-y-12">
      {/* ── Theme ── */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
          Theme
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Choose how GOO looks. Applies instantly across the whole site.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => setPreference(opt.id)}
                aria-pressed={active}
                className={`flex items-center gap-3.5 p-4 rounded-xl border text-left transition-all duration-200 ${
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)]"
                    : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                <span className={active ? "text-[var(--background)]" : "text-[var(--foreground-muted)]"}>
                  {opt.icon}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${active ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                    {opt.label}
                  </span>
                  <span className={`block text-xs mt-0.5 ${active ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                    {opt.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {preference === "system" && (
          <p className="text-[11px] text-[var(--foreground-subtle)] mt-3">
            Following your device — currently {theme === "dark" ? "dark" : "light"}.
          </p>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[var(--border)]" />

      {/* ── Currency ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
            Currency
          </p>
          <span className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-subtle)]">
            e.g. {formatPrice(1200)}
          </span>
        </div>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Prices across the site are shown in this currency. Saved for next time.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CURRENCIES.map((c) => {
            const active = currency === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setCurrency(c.code as CurrencyCode)}
                aria-pressed={active}
                className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-all duration-200 ${
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)]"
                    : "border-[var(--border)] hover:border-[var(--foreground-muted)] hover:bg-[var(--surface)]"
                }`}
              >
                <span
                  className={`w-9 h-9 shrink-0 rounded-lg flex items-center justify-center text-base font-semibold ${
                    active
                      ? "bg-[var(--background)]/15 text-[var(--background)]"
                      : "bg-[var(--surface)] text-[var(--foreground)]"
                  }`}
                >
                  {c.symbol}
                </span>
                <span className="min-w-0">
                  <span className={`block text-sm font-medium ${active ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                    {c.code}
                  </span>
                  <span className={`block text-xs mt-0.5 truncate ${active ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                    {c.name}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Plan Tab ───────────────────────────────────────────────────────────────────
function PlanTab({ currentPlan }: { currentPlan: PlanId }) {
  const isPaid = currentPlan !== "free";
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [loadingBilling, setLoadingBilling] = useState(isPaid);
  const [canceling, setCanceling] = useState(false);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    if (!isPaid) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/billing/status");
        const body = await res.json().catch(() => ({}));
        if (active && body.subscription) {
          setBilling(body.subscription as BillingStatus);
          setCanceled(!body.subscription.autoRenew);
        }
      } finally {
        if (active) setLoadingBilling(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isPaid]);

  const handleCancel = async () => {
    if (canceling || canceled) return;
    if (!window.confirm("Cancel auto-renewal? You'll keep access until the end of the current period.")) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/billing/cancel", { method: "POST" });
      if (res.ok) setCanceled(true);
    } finally {
      setCanceling(false);
    }
  };

  return (
    <div className="animate-fade-up space-y-10">

      {/* Current plan card */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
          Current plan
        </p>
        <div className="p-6 border border-[var(--foreground)] rounded-2xl">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-2xl font-light text-[var(--foreground)] capitalize">
                {PLANS[currentPlan].name}
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {currentPlan === "free" ? "Free forever" : `${planPriceDual(currentPlan)} / month`}
              </p>
            </div>
            {currentPlan !== "premium" && (
              <Link
                href="/plans"
                className="text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] rounded-xl px-5 py-2.5 hover:opacity-80 transition-opacity"
              >
                Upgrade
              </Link>
            )}
          </div>

          <div className="space-y-3 pt-5 border-t border-[var(--border)]">
            {ALL_FEATURES.map((feature) => {
              const unlocked = (PLANS[currentPlan].features as string[]).includes(feature);
              return (
                <div key={feature} className="flex items-center gap-3">
                  <span className={`w-4 h-4 flex items-center justify-center shrink-0 ${unlocked ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)]"}`}>
                    {unlocked ? (
                      <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                        <path d="M1 5L4.5 8.5L11 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    )}
                  </span>
                  <span className={`text-xs ${unlocked ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)] line-through"}`}>
                    {PLAN_FEATURE_LABELS[feature] ?? feature}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Billing */}
      {isPaid ? (
        <>
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
              Billing
            </p>
            <div className="border border-[var(--border)] rounded-xl overflow-hidden divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs text-[var(--foreground-muted)]">
                  {canceled ? "Access until" : "Next payment"}
                </p>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {canceled
                    ? formatDate(billing?.currentPeriodEnd)
                    : `${planPriceDual(currentPlan)} on ${formatDate(billing?.currentPeriodEnd)}`}
                </p>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs text-[var(--foreground-muted)]">Billing cycle</p>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  {canceled ? "Canceled — won't renew" : "Monthly (auto-renew)"}
                </p>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs text-[var(--foreground-muted)]">Payment method</p>
                <p className="text-xs font-medium text-[var(--foreground)] flex items-center gap-2">
                  {loadingBilling ? (
                    <span className="text-[var(--foreground-subtle)]">Loading…</span>
                  ) : billing?.maskedPan ? (
                    <>
                      <span className="text-[var(--foreground-subtle)] tracking-widest">••••</span>
                      {billing.maskedPan.slice(-4)}
                      <span className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] px-1.5 py-0.5">
                        monobank
                      </span>
                    </>
                  ) : (
                    <span className="text-[var(--foreground-subtle)]">monobank</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Manage */}
          <div className="pt-2">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
              Manage
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/plans"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] rounded-xl px-6 py-3 hover:border-[var(--foreground)] transition-colors duration-200 text-center"
              >
                Change plan
              </Link>
              <button
                onClick={handleCancel}
                disabled={canceling || canceled}
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] rounded-xl px-6 py-3 hover:border-[var(--foreground-muted)] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {canceled ? "Auto-renewal canceled" : canceling ? "Canceling…" : "Cancel subscription"}
              </button>
            </div>
            <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
              {canceled
                ? "Your subscription won't renew. You keep access until the date above."
                : "Secure recurring billing via monobank. Cancel anytime — you keep access until the current period ends."}
            </p>
          </div>
        </>
      ) : (
        <>
          {/* Compare plans for free users */}
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
              Compare plans
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(["basic", "pro", "premium"] as PlanId[]).map((planId) => {
                const plan = PLANS[planId];
                const isUpgrade = PLAN_ORDER.indexOf(planId) > PLAN_ORDER.indexOf(currentPlan);
                return (
                  <div key={planId} className="p-4 border border-[var(--border)] rounded-xl hover:border-[var(--foreground-muted)] hover:shadow-sm transition-all duration-200">
                    <p className="text-xs font-medium text-[var(--foreground)] capitalize">{plan.name}</p>
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-1 mb-3">{planPriceDual(planId)}/mo</p>
                    {isUpgrade && (
                      <Link
                        href={`/subscribe?plan=${planId}`}
                        className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground)] hover:opacity-60 transition-opacity"
                      >
                        Select →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-[var(--foreground-muted)] mt-4">
              <Link href="/plans" className="link-underline text-[var(--foreground)]">
                View full comparison →
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ── AI Stylist Tab ─────────────────────────────────────────────────────────────
function StylistTab({
  personalization,
  onCustomize,
  bodyType, setBodyType,
  budget, setBudget,
  selectedColors, setSelectedColors,
  selectedStyles, setSelectedStyles,
  sizes, setSizes,
  onSaveStyle, styleSaved, styleSaving,
}: {
  personalization: StylistPersonalization | null;
  onCustomize: () => void;
  bodyType: BodyType | null;
  setBodyType: (v: BodyType) => void;
  budget: string | null;
  setBudget: (v: string) => void;
  selectedColors: string[];
  setSelectedColors: (v: string[]) => void;
  selectedStyles: StyleKeyword[];
  setSelectedStyles: (v: StyleKeyword[]) => void;
  sizes: { tops: string; bottoms: string; shoes: string; dresses: string };
  setSizes: (v: { tops: string; bottoms: string; shoes: string; dresses: string }) => void;
  onSaveStyle: () => void;
  styleSaved: boolean;
  styleSaving: boolean;
}) {
  const toggleColor = (hex: string) => {
    setSelectedColors(
      selectedColors.includes(hex)
        ? selectedColors.filter((c) => c !== hex)
        : selectedColors.length < 6
        ? [...selectedColors, hex]
        : selectedColors
    );
  };

  const toggleStyle = (s: StyleKeyword) => {
    setSelectedStyles(
      selectedStyles.includes(s)
        ? selectedStyles.filter((x) => x !== s)
        : [...selectedStyles, s]
    );
  };

  return (
    <div className="animate-fade-up space-y-12">

      {/* ── Personalization section ── */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
          Personalization
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-6">
          Tell GOO your goals, limits, and how you live — applied to every recommendation.
        </p>

        {personalization ? (
          <div className="space-y-5">
            <div className="p-5 border border-[var(--border)] rounded-xl space-y-4">
              {personalization.nickname && (
                <div>
                  <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Name</p>
                  <p className="text-sm text-[var(--foreground)]">
                    {personalization.nickname}
                    {personalization.pronouns && personalization.pronouns !== "Skip" && (
                      <span className="text-[var(--foreground-muted)] ml-2 text-xs">({personalization.pronouns})</span>
                    )}
                  </p>
                </div>
              )}
              {personalization.styleGoals?.length > 0 && (
                <div>
                  <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">Style goals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {personalization.styleGoals.map((g) => (
                      <span key={g} className="text-[10px] tracking-[0.08em] border border-[var(--border)] rounded-full px-2.5 py-1 text-[var(--foreground-muted)]">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {personalization.lifestyle && (
                <div>
                  <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Lifestyle</p>
                  <p className="text-sm text-[var(--foreground)]">
                    {LIFESTYLE_OPTIONS.find((o) => o.id === personalization.lifestyle)?.label ?? personalization.lifestyle}
                  </p>
                </div>
              )}
              {personalization.hardLimits && (
                <div>
                  <p className="text-[9px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1.5">Hard limits</p>
                  <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{personalization.hardLimits}</p>
                </div>
              )}
            </div>
            <button
              onClick={onCustomize}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] rounded-xl px-6 py-3 hover:border-[var(--foreground)] transition-colors duration-200"
            >
              Edit personalization
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-6 border border-dashed border-[var(--border)] rounded-xl">
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">Not yet personalized</p>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                2 minutes. Makes every AI recommendation significantly more personal.
              </p>
            </div>
            <button
              onClick={onCustomize}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] rounded-xl px-8 py-4 hover:opacity-80 transition-opacity duration-200"
            >
              Personalize AI Stylist →
            </button>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[var(--border)]" />

      {/* ── Style Profile section ── */}
      <div className="space-y-12">
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
            Style profile
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            Colours, aesthetics, and sizing — GOO uses these to tailor every outfit.
          </p>
        </div>

        {/* Colour palette */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
              Colour palette
            </p>
            <span className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-subtle)]">
              {selectedColors.length} / 6
            </span>
          </div>
          <p className="text-xs text-[var(--foreground-muted)] mb-5">
            Pick up to 6 colours you gravitate towards.
          </p>
          <div className="grid grid-cols-8 gap-2">
            {COLOR_PALETTE.map((color) => {
              const isSelected = selectedColors.includes(color.hex);
              const atMax = selectedColors.length >= 6 && !isSelected;
              return (
                <button
                  key={color.hex}
                  onClick={() => toggleColor(color.hex)}
                  title={color.name}
                  disabled={atMax}
                  className={`group relative aspect-square rounded-full transition-all duration-200 ${
                    isSelected
                      ? "ring-2 ring-offset-2 ring-[var(--foreground)] ring-offset-[var(--background)] scale-105"
                      : atMax
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color.hex }}
                >
                  {isSelected && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path
                          d="M1 4L3.5 6.5L9 1"
                          stroke={color.light ? "#0A0A0A" : "#F0EEE8"}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-[9px] tracking-[0.06em] whitespace-nowrap bg-[var(--foreground)] text-[var(--background)] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                    {color.name}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedColors.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[9px] tracking-[0.12em] uppercase text-[var(--foreground-subtle)]">Your palette:</span>
              {selectedColors.map((hex) => {
                const c = COLOR_PALETTE.find((x) => x.hex === hex);
                return (
                  <span key={hex} className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] rounded-full px-2 py-1">
                    <span className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: hex }} />
                    {c?.name}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Aesthetic */}
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-2">
            Your aesthetic
          </p>
          <p className="text-xs text-[var(--foreground-muted)] mb-5">
            Select all that speak to you.
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLE_KEYWORDS.map((kw) => (
              <button
                key={kw}
                onClick={() => toggleStyle(kw)}
                className={`text-[10px] tracking-[0.12em] uppercase font-medium px-4 py-2 border rounded-full transition-all duration-200 ${
                  selectedStyles.includes(kw)
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* Body type */}
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
            Body type
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {BODY_TYPES.map((bt) => (
              <button
                key={bt.id}
                onClick={() => setBodyType(bt.id)}
                className={`p-5 text-left transition-colors duration-200 rounded-xl border ${
                  bodyType === bt.id
                    ? "bg-[var(--foreground)] rounded-xl border-[var(--foreground)]"
                    : "bg-[var(--background)] border-[var(--border)] hover:bg-[var(--surface)] hover:border-[var(--foreground-muted)]"
                }`}
              >
                <p className={`text-sm font-medium mb-0.5 ${bodyType === bt.id ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                  {bt.label}
                </p>
                <p className={`text-xs ${bodyType === bt.id ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                  {bt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
            Your sizes
          </p>
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                { key: "tops" as const, label: "Tops", placeholder: "XS / S / M / L / XL" },
                { key: "bottoms" as const, label: "Bottoms", placeholder: "28 / 29 / 30..." },
                { key: "shoes" as const, label: "Shoes", placeholder: "EU 38 / UK 5..." },
                { key: "dresses" as const, label: "Dresses", placeholder: "34 / 36 / 38..." },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] block mb-2">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={sizes[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setSizes({ ...sizes, [field.key]: e.target.value })}
                  className="w-full bg-transparent border border-[var(--border)] rounded-lg text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-200"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
            Typical outfit budget
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_OPTIONS.map((b) => (
              <button
                key={b.label}
                onClick={() => setBudget(b.label)}
                className={`p-4 text-left border rounded-xl transition-all duration-200 ${
                  budget === b.label
                    ? "border-[var(--foreground)] bg-[var(--foreground)]"
                    : "border-[var(--border)] hover:border-[var(--foreground)]"
                }`}
              >
                <p className={`text-sm font-medium ${budget === b.label ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                  {b.label}
                </p>
                <p className={`text-xs mt-0.5 ${budget === b.label ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                  {b.range}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Save style */}
        <div className="flex items-center gap-4">
          <button
            onClick={onSaveStyle}
            disabled={styleSaving}
            className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] rounded-xl px-8 py-4 hover:opacity-80 transition-opacity duration-200 disabled:opacity-40"
          >
            {styleSaving ? "Saving..." : "Save style profile"}
          </button>
          {styleSaved && (
            <p className="text-xs text-[var(--foreground-muted)] animate-fade-in">Saved.</p>
          )}
        </div>
      </div>
    </div>
  );
}
