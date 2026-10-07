"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { StyleKeyword } from "@/lib/types";
import { STYLE_KEYWORD_LIST as STYLE_KEYWORDS } from "@/lib/style-keywords";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";

import { useAuth } from "@/lib/context/auth-context";
import { useTheme, type ThemePreference } from "@/lib/context/theme-context";
import { useCurrency, CURRENCIES, type CurrencyCode } from "@/lib/context/currency-context";
import Link from "next/link";
import { PLANS, PLAN_ORDER, planPriceDual, type PlanId } from "@/lib/plans";
import { StylistPersonalizationModal, LIFESTYLE_OPTIONS as LIFESTYLE_OPTIONS_IMPORT, type StylistPersonalization } from "@/components/stylist/StylistPersonalizationModal";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "account" | "plan" | "stylist";
type BodyType = "slim" | "athletic" | "average" | "curvy" | "petite" | "tall";
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
function ProfileInner() {
  const { user } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();

  const [activeTab, setActiveTab] = useState<Tab>("account");

  // Open the tab a link asked for.
  //
  // Read through useSearchParams rather than window.location: a header entry
  // can be clicked while this page is already open, which changes the query
  // without remounting anything, and a mount-only read would leave the Account
  // tab showing.
  //
  // The looks a person builds live on /saved again, so ?tab=looks is carried
  // there rather than dropped: bookmarks and anything still pointing at the
  // profile for them keep working.
  const tabParam = useSearchParams().get("tab");
  const router = useRouter();
  useEffect(() => {
    if (tabParam === "looks") {
      router.replace("/saved?tab=looks");
    } else if (tabParam === "account" || tabParam === "plan" || tabParam === "stylist") {
      setActiveTab(tabParam);
    }
  }, [tabParam, router]);

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
    { id: "plan", label: "Plan" },
    { id: "stylist", label: "AI stylist" },
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
      <div className="max-w-[1440px] mx-auto px-3 md:px-12">
        <div className="pt-3 md:pt-16">

          {/* Phones: the user card instead of the big name (mockup «Б · Профиль») */}
          <div className="md:hidden mb-3 p-4 rounded-2xl bg-[var(--surface)] flex items-center gap-3.5 animate-fade-up">
            <span className="w-[52px] h-[52px] rounded-full overflow-hidden bg-[var(--fg-overlay-08)] shrink-0 flex items-center justify-center text-[20px] font-medium text-[var(--foreground)]">
              {clerkUser?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={clerkUser.imageUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                user?.name?.[0]?.toUpperCase() ?? "?"
              )}
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="text-[18px] font-semibold text-[var(--foreground)] truncate">{user?.name ?? "Your profile"}</h1>
              {user?.email && <p className="mt-0.5 text-[13px] text-[var(--foreground-muted)] truncate">{user.email}</p>}
            </div>
            <span className="h-[26px] px-2.5 rounded-full bg-[var(--foreground)] text-[var(--background)] flex items-center text-[12px] font-semibold shrink-0">
              {PLANS[user?.plan ?? "free"].name}
            </span>
          </div>

          {/* Header */}
          <div className="hidden md:block mb-10 animate-fade-up">
            <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-3">
              Profile
            </p>
            <h1 className="text-4xl md:text-5xl font-black uppercase text-[var(--foreground)]">
              {user?.name ?? "Your profile."}
            </h1>
          </div>

          {/* Tabs. Phones: a three-up segmented control (DESIGN_SYSTEM.md §12.10). */}
          <div className="grid grid-cols-3 h-11 mb-4 rounded-full bg-[var(--surface)] shadow-[inset_0_0_0_1px_var(--border)] md:flex md:gap-0 md:h-auto md:mb-10 md:w-fit md:p-1 md:border md:border-[var(--border)] md:shadow-none md:overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative min-w-0 h-11 px-1 text-[14px] md:h-auto md:px-5 md:py-2 md:text-[10px] md:tracking-[0.16em] md:uppercase font-medium ${activeTab === tab.id ? "max-md:font-semibold" : ""} rounded-full whitespace-nowrap z-10 transition-colors duration-200`}
                style={{ color: activeTab === tab.id ? "var(--background)" : "var(--foreground-muted)" }}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="profile-tab-pill"
                    className="absolute inset-[3px] md:inset-0 rounded-full bg-[var(--foreground)]"
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
              // Every panel here reads as a column of settings.
              className="max-w-2xl pb-8 md:pb-20"
            >
              {activeTab === "account" && (
                <AccountTab user={user} clerkUser={clerkUser} />
              )}
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

// ── Page (wrapped in Suspense for useSearchParams) ────────────────────────────

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileInner />
    </Suspense>
  );
}

// ── Account Tab ────────────────────────────────────────────────────────────────
const THEME_OPTIONS: { id: ThemePreference; label: string; icon: React.ReactNode }[] = [
  {
    id: "light",
    label: "Light",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "dark",
    label: "Dark",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

function AccountTab({
  user,
  clerkUser,
}: {
  user: { name: string; email: string; plan: PlanId; joinedAt: string } | null;
  clerkUser: ReturnType<typeof useUser>["user"];
}) {
  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const { currency, setCurrency, formatPrice } = useCurrency();
  const plan = user?.plan ?? "free";
  const currencyInfo = CURRENCIES.find((c) => c.code === currency);

  return (
    <>
    {/* Phones: settings as rows on plaques (mockup «Б · Профиль», DESIGN_SYSTEM.md §12.11).
        The name, email and plan are on the user card above the tabs. */}
    <div className="md:hidden animate-fade-up space-y-3">
      <div className="rounded-2xl bg-[var(--surface)] overflow-hidden">
        <Link href="/plans" className="h-14 flex items-center gap-2.5 px-4 text-[var(--foreground)]">
          <span className="flex-1 text-[15px]">Plan</span>
          <span className="text-[15px] text-[var(--foreground-muted)]">
            {PLANS[plan].name}{plan === "free" ? " · Upgrade" : ""}
          </span>
          <RowChevron />
        </Link>
        <div className="h-14 flex items-center gap-2.5 pl-4 pr-2.5 shadow-[inset_0_1px_0_var(--border)]">
          <span className="flex-1 text-[15px] text-[var(--foreground)]">Appearance</span>
          <div role="radiogroup" aria-label="Theme" className="flex p-[3px] rounded-xl bg-[var(--fg-overlay-08)]">
            {THEME_OPTIONS.map((opt) => {
              const active = preference === opt.id;
              return (
                <button
                  key={opt.id}
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPreference(opt.id)}
                  className={`relative h-[34px] px-3.5 rounded-[9px] text-[13px] after:absolute after:inset-x-0 after:-inset-y-[5px] transition-colors duration-200 ${
                    active ? "bg-[var(--foreground)] text-[var(--background)] font-semibold" : "text-[var(--foreground-muted)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        {/* The row shows the choice; a native select over it opens the phone's own picker. */}
        <label className="relative h-14 flex items-center gap-2.5 px-4 shadow-[inset_0_1px_0_var(--border)] has-[:focus-visible]:shadow-[inset_0_0_0_2px_var(--border-strong)] text-[var(--foreground)]">
          <span className="flex-1 text-[15px]">Currency</span>
          <span className="text-[15px] text-[var(--foreground-muted)] truncate">
            {currencyInfo ? `${currencyInfo.name}, ${currencyInfo.symbol}` : currency}
          </span>
          <RowChevron />
          <select
            aria-label="Currency"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>{c.name} ({c.symbol})</option>
            ))}
          </select>
        </label>
      </div>
      <div className="rounded-2xl bg-[var(--surface)] overflow-hidden">
        <button onClick={logout} className="w-full h-14 flex items-center gap-2.5 px-4 text-[15px] text-[var(--foreground)]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 4h5v16h-5M10 16l4-4-4-4M14 12H4" />
          </svg>
          Sign out
        </button>
      </div>
    </div>

    <div className="hidden md:block animate-fade-up space-y-10">
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

      {/* Appearance — theme */}
      <div>
        <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-4">
          Appearance
        </p>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="inline-flex bg-[var(--surface)] rounded-full p-1 border border-[var(--border)]"
        >
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.id;
            return (
              <button
                key={opt.id}
                role="radio"
                aria-checked={active}
                onClick={() => setPreference(opt.id)}
                className={`relative flex items-center gap-1.5 px-4 py-2 rounded-full text-[10px] tracking-[0.14em] uppercase font-medium transition-colors duration-200 ${
                  active ? "text-[var(--background)]" : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="account-theme-pill"
                    className="absolute inset-0 rounded-full bg-[var(--foreground)]"
                    transition={{ type: "spring", stiffness: 400, damping: 35 }}
                    style={{ zIndex: 0 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {opt.icon}
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

      </div>

      {/* Currency */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)]">
            Currency
          </p>
          <span className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-subtle)]">
            e.g. {formatPrice(1200)}
          </span>
        </div>
        <div role="radiogroup" aria-label="Display currency" className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => {
            const active = currency === c.code;
            return (
              <button
                key={c.code}
                role="radio"
                aria-checked={active}
                onClick={() => setCurrency(c.code as CurrencyCode)}
                title={c.name}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-[11px] font-medium transition-colors duration-200 ${
                  active
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <span className="text-sm">{c.symbol}</span>
                {c.code}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-[var(--foreground-subtle)] mt-3">
          Prices across the site are shown in {CURRENCIES.find((c) => c.code === currency)?.name ?? currency}.
        </p>
      </div>

      {/* Session */}
      <div>
        <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
          Session
        </p>
        <button
          onClick={logout}
          className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] rounded-xl px-6 py-3 hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-colors duration-200"
        >
          Sign out
        </button>
      </div>
    </div>
    </>
  );
}

/** The chevron at the end of a settings row (DESIGN_SYSTEM.md §12.11). */
function RowChevron() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--foreground-muted)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0">
      <path d="M9 6l6 6-6 6" />
    </svg>
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
    <div className="animate-fade-up space-y-6 md:space-y-10">

      {/* Current plan card */}
      <div>
        <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
          Current plan
        </p>
        <div className="p-4 rounded-2xl bg-[var(--surface)] md:p-6 md:bg-transparent md:border md:border-[var(--foreground)]">
          <div className="flex items-start justify-between mb-4 md:mb-5">
            <div>
              <p className="text-[20px] font-semibold md:text-2xl md:font-light text-[var(--foreground)] capitalize">
                {PLANS[currentPlan].name}
              </p>
              <p className="text-[13px] md:text-xs text-[var(--foreground-muted)] mt-1">
                {currentPlan === "free" ? "Free forever" : `${planPriceDual(currentPlan)} / month`}
              </p>
            </div>
            {currentPlan !== "premium" && (
              <Link
                href="/plans"
                className="h-11 px-5 rounded-full flex items-center text-[15px] font-semibold md:h-auto md:block md:rounded-xl md:py-2.5 md:text-[10px] md:tracking-[0.14em] md:uppercase md:font-medium text-[var(--background)] bg-[var(--foreground)] hover:opacity-80 transition-opacity"
              >
                Upgrade
              </Link>
            )}
          </div>

          <div className="space-y-3 pt-4 md:pt-5 border-t border-[var(--border)]">
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
                  <span className={`text-[14px] md:text-xs ${unlocked ? "text-[var(--foreground)]" : "text-[var(--foreground-subtle)] line-through"}`}>
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
            <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
              Billing
            </p>
            <div className="rounded-2xl bg-[var(--surface)] md:bg-transparent md:rounded-xl md:border md:border-[var(--border)] overflow-hidden divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between gap-3 min-h-14 px-4 py-3 md:gap-0 md:min-h-0 md:px-5 md:py-4">
                <p className="max-md:shrink-0 text-[14px] md:text-xs text-[var(--foreground-muted)]">
                  {canceled ? "Access until" : "Next payment"}
                </p>
                <p className="max-md:text-right text-[14px] md:text-xs font-medium text-[var(--foreground)]">
                  {canceled
                    ? formatDate(billing?.currentPeriodEnd)
                    : `${planPriceDual(currentPlan)} on ${formatDate(billing?.currentPeriodEnd)}`}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 min-h-14 px-4 py-3 md:gap-0 md:min-h-0 md:px-5 md:py-4">
                <p className="max-md:shrink-0 text-[14px] md:text-xs text-[var(--foreground-muted)]">Billing cycle</p>
                <p className="max-md:text-right text-[14px] md:text-xs font-medium text-[var(--foreground)]">
                  {canceled ? "Canceled — won't renew" : "Monthly (auto-renew)"}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 min-h-14 px-4 py-3 md:gap-0 md:min-h-0 md:px-5 md:py-4">
                <p className="max-md:shrink-0 text-[14px] md:text-xs text-[var(--foreground-muted)]">Payment method</p>
                <p className="max-md:text-right text-[14px] md:text-xs font-medium text-[var(--foreground)] flex items-center gap-2">
                  {loadingBilling ? (
                    <span className="text-[var(--foreground-subtle)]">Loading…</span>
                  ) : billing?.maskedPan ? (
                    <>
                      <span className="text-[var(--foreground-subtle)] tracking-widest">••••</span>
                      {billing.maskedPan.slice(-4)}
                      <span className="text-[11px] md:text-[9px] md:tracking-[0.10em] md:uppercase text-[var(--foreground-subtle)] border border-[var(--border)] rounded-full md:rounded-none px-2 md:px-1.5 py-0.5">
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
            <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
              Manage
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/plans"
                className="h-12 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[15px] font-medium text-[var(--foreground)] md:h-auto md:block md:bg-transparent md:text-xs md:tracking-[0.14em] md:uppercase md:border md:border-[var(--border)] md:rounded-xl md:px-6 md:py-3 md:hover:border-[var(--foreground)] transition-colors duration-200 text-center"
              >
                Change plan
              </Link>
              <button
                onClick={handleCancel}
                disabled={canceling || canceled}
                className="h-12 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[15px] font-medium text-[var(--foreground-muted)] md:h-auto md:block md:bg-transparent md:text-xs md:tracking-[0.14em] md:uppercase md:border md:border-[var(--border)] md:rounded-xl md:px-6 md:py-3 md:hover:border-[var(--foreground-muted)] transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {canceled ? "Auto-renewal canceled" : canceling ? "Canceling…" : "Cancel subscription"}
              </button>
            </div>
            <p className="px-1 md:px-0 text-[12px] md:text-[10px] max-md:leading-relaxed text-[var(--foreground-subtle)] mt-3 md:mt-4">
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
            <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
              Compare plans
            </p>
            <div className="rounded-2xl bg-[var(--surface)] overflow-hidden md:grid md:grid-cols-3 md:gap-3 md:rounded-none md:bg-transparent md:overflow-visible">
              {(["basic", "pro", "premium"] as PlanId[]).map((planId) => {
                const plan = PLANS[planId];
                const isUpgrade = PLAN_ORDER.indexOf(planId) > PLAN_ORDER.indexOf(currentPlan);
                return (
                  <div key={planId} className="flex items-center gap-3 min-h-14 px-4 py-1.5 max-md:not-first:shadow-[inset_0_1px_0_var(--border)] md:block md:min-h-0 md:p-4 md:border md:border-[var(--border)] md:rounded-xl md:hover:border-[var(--foreground-muted)] md:hover:shadow-sm transition-colors duration-200">
                    <p className="flex-1 text-[15px] md:text-xs font-medium text-[var(--foreground)] capitalize">{plan.name}</p>
                    <p className="text-[13px] md:text-[10px] text-[var(--foreground-muted)] md:mt-1 md:mb-3">{planPriceDual(planId)}/mo</p>
                    {isUpgrade && (
                      <Link
                        href={`/subscribe?plan=${planId}`}
                        className="h-11 flex items-center text-[14px] font-medium md:h-auto md:inline md:text-[9px] md:tracking-[0.12em] md:uppercase md:font-normal text-[var(--foreground)] hover:opacity-60 transition-opacity"
                      >
                        Select →
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="px-1 md:px-0 text-[14px] md:text-xs text-[var(--foreground-muted)] mt-3 md:mt-4">
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
    <div className="animate-fade-up space-y-8 md:space-y-12">

      {/* ── Personalization section ── */}
      <div>
        <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-1.5 md:mb-2">
          Personalization
        </p>
        <p className="px-1 md:px-0 text-sm text-[var(--foreground-muted)] leading-relaxed mb-4 md:mb-6">
          Tell GOO your goals, limits, and how you live — applied to every recommendation.
        </p>

        {personalization ? (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--surface)] md:p-5 md:bg-transparent md:border md:border-[var(--border)] md:rounded-xl space-y-4">
              {personalization.nickname && (
                <div>
                  <p className="text-[12px] text-[var(--foreground-muted)] md:text-[9px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)] mb-1.5">Name</p>
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
                  <p className="text-[12px] text-[var(--foreground-muted)] md:text-[9px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)] mb-2">Style goals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {personalization.styleGoals.map((g) => (
                      <span key={g} className="text-[12px] md:text-[10px] md:tracking-[0.08em] bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] rounded-full px-2.5 py-1 text-[var(--foreground-muted)]">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {personalization.lifestyle && (
                <div>
                  <p className="text-[12px] text-[var(--foreground-muted)] md:text-[9px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)] mb-1.5">Lifestyle</p>
                  <p className="text-sm text-[var(--foreground)]">
                    {LIFESTYLE_OPTIONS.find((o) => o.id === personalization.lifestyle)?.label ?? personalization.lifestyle}
                  </p>
                </div>
              )}
              {personalization.hardLimits && (
                <div>
                  <p className="text-[12px] text-[var(--foreground-muted)] md:text-[9px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)] mb-1.5">Hard limits</p>
                  <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{personalization.hardLimits}</p>
                </div>
              )}
            </div>
            <button
              onClick={onCustomize}
              className="w-full md:w-auto h-12 rounded-full bg-[var(--fg-overlay-08)] flex items-center justify-center text-[15px] font-medium text-[var(--foreground)] md:h-auto md:inline-block md:bg-transparent md:text-xs md:tracking-[0.14em] md:uppercase md:border md:border-[var(--border)] md:rounded-xl md:px-6 md:py-3 md:hover:border-[var(--foreground)] transition-colors duration-200"
            >
              Edit personalization
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--surface)] md:p-6 md:bg-transparent md:border md:border-dashed md:border-[var(--border)] md:rounded-xl">
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">Not yet personalized</p>
              <p className="text-[13px] md:text-xs text-[var(--foreground-muted)] leading-relaxed">
                2 minutes. Makes every AI recommendation significantly more personal.
              </p>
            </div>
            <button
              onClick={onCustomize}
              className="w-full md:w-auto h-12 rounded-full flex items-center justify-center text-[15px] font-semibold md:h-auto md:inline-block md:text-xs md:tracking-[0.14em] md:uppercase md:font-medium md:rounded-xl md:px-8 md:py-4 text-[var(--background)] bg-[var(--foreground)] hover:opacity-80 transition-opacity duration-200"
            >
              Personalize AI Stylist →
            </button>
          </div>
        )}
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-[var(--border)]" />

      {/* ── Style Profile section ── */}
      <div className="space-y-8 md:space-y-12">
        <div>
          <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-1.5 md:mb-2">
            Style profile
          </p>
          <p className="px-1 md:px-0 text-sm text-[var(--foreground-muted)] leading-relaxed">
            Colours, aesthetics, and sizing — GOO uses these to tailor every outfit.
          </p>
        </div>

        {/* Colour palette */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)]">
              Colour palette
            </p>
            <span className="px-1 md:px-0 text-[12px] md:text-[9px] md:tracking-[0.10em] md:uppercase text-[var(--foreground-subtle)]">
              {selectedColors.length} / 6
            </span>
          </div>
          <p className="px-1 md:px-0 text-[13px] md:text-xs text-[var(--foreground-muted)] mb-4 md:mb-5">
            Pick up to 6 colours you gravitate towards.
          </p>
          {/* Phones: six to a row, so every swatch is a 44px+ target. */}
          <div className="grid grid-cols-6 gap-3 md:grid-cols-8 md:gap-2">
            {COLOR_PALETTE.map((color) => {
              const isSelected = selectedColors.includes(color.hex);
              const atMax = selectedColors.length >= 6 && !isSelected;
              return (
                <button
                  key={color.hex}
                  onClick={() => toggleColor(color.hex)}
                  title={color.name}
                  disabled={atMax}
                  className={`group relative aspect-square rounded-full transition-[color,background-color,border-color,opacity,transform] duration-200 ${
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
                  <span className="max-md:hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 text-[9px] tracking-[0.06em] whitespace-nowrap bg-[var(--foreground)] text-[var(--background)] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-10">
                    {color.name}
                  </span>
                </button>
              );
            })}
          </div>
          {selectedColors.length > 0 && (
            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="px-1 md:px-0 text-[12px] md:text-[9px] md:tracking-[0.12em] md:uppercase text-[var(--foreground-subtle)]">Your palette:</span>
              {selectedColors.map((hex) => {
                const c = COLOR_PALETTE.find((x) => x.hex === hex);
                return (
                  <span key={hex} className="flex items-center gap-1.5 text-[12px] md:text-[9px] md:tracking-[0.08em] md:uppercase text-[var(--foreground-muted)] bg-[var(--fg-overlay-08)] md:bg-transparent md:border md:border-[var(--border)] rounded-full px-2.5 md:px-2 py-1">
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
          <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-1.5 md:mb-2">
            Your aesthetic
          </p>
          <p className="px-1 md:px-0 text-[13px] md:text-xs text-[var(--foreground-muted)] mb-4 md:mb-5">
            Select all that speak to you.
          </p>
          <div className="flex flex-wrap gap-2">
            {STYLE_KEYWORDS.map((kw) => (
              <button
                key={kw}
                onClick={() => toggleStyle(kw)}
                // Phones: a chip (DESIGN_SYSTEM.md §12.10) with `after:` stretching it to a 44px target.
                className={`relative h-9 px-3.5 text-[13px] capitalize max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-1 md:h-auto md:px-4 md:py-2 md:text-[10px] md:tracking-[0.12em] md:uppercase font-medium md:border rounded-full transition-colors duration-200 ${
                  selectedStyles.includes(kw)
                    ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                    : "bg-[var(--fg-overlay-08)] text-[var(--foreground)] md:bg-transparent md:border-[var(--border)] md:text-[var(--foreground-muted)] md:hover:border-[var(--foreground)] md:hover:text-[var(--foreground)]"
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </div>

        {/* Body type */}
        <div>
          <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
            Body type
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {BODY_TYPES.map((bt) => (
              <button
                key={bt.id}
                onClick={() => setBodyType(bt.id)}
                className={`p-4 md:p-5 text-left transition-colors duration-200 rounded-2xl md:rounded-xl border ${
                  bodyType === bt.id
                    ? "bg-[var(--foreground)] border-[var(--foreground)]"
                    : "bg-[var(--surface)] border-transparent md:bg-[var(--background)] md:border-[var(--border)] md:hover:bg-[var(--surface)] md:hover:border-[var(--foreground-muted)]"
                }`}
              >
                <p className={`text-sm font-medium mb-0.5 ${bodyType === bt.id ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                  {bt.label}
                </p>
                <p className={`text-[13px] md:text-xs ${bodyType === bt.id ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                  {bt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Sizes */}
        <div>
          <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
            Your sizes
          </p>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            {(
              [
                { key: "tops" as const, label: "Tops", placeholder: "XS / S / M / L / XL" },
                { key: "bottoms" as const, label: "Bottoms", placeholder: "28 / 29 / 30..." },
                { key: "shoes" as const, label: "Shoes", placeholder: "EU 38 / UK 5..." },
                { key: "dresses" as const, label: "Dresses", placeholder: "34 / 36 / 38..." },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label className="block mb-1.5 md:mb-2 px-1 md:px-0 text-[13px] text-[var(--foreground-muted)] md:text-[10px] md:tracking-[0.14em] md:uppercase md:text-[var(--foreground-subtle)]">
                  {field.label}
                </label>
                <input
                  type="text"
                  value={sizes[field.key]}
                  placeholder={field.placeholder}
                  onChange={(e) => setSizes({ ...sizes, [field.key]: e.target.value })}
                  // Phones: 16px, or iOS zooms the page on focus (DESIGN_SYSTEM.md §12.1).
                  className="w-full h-12 md:h-auto bg-[var(--surface)] md:bg-transparent border border-[var(--border)] max-md:rounded-2xl! md:rounded-lg text-base md:text-sm text-[var(--foreground)] px-4 md:py-3 placeholder-[var(--foreground-subtle)] focus:outline-none max-md:outline-none! focus:border-[var(--foreground)] transition-colors duration-200"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Budget */}
        <div>
          <p className="px-1 text-[13px] text-[var(--foreground-muted)] md:px-0 md:text-[10px] md:tracking-[0.18em] md:uppercase md:font-medium md:text-[var(--foreground-subtle)] mb-2 md:mb-5">
            Typical outfit budget
          </p>
          <div className="grid grid-cols-2 gap-3">
            {BUDGET_OPTIONS.map((b) => (
              <button
                key={b.label}
                onClick={() => setBudget(b.label)}
                className={`p-4 text-left border rounded-2xl md:rounded-xl transition-colors duration-200 ${
                  budget === b.label
                    ? "border-[var(--foreground)] bg-[var(--foreground)]"
                    : "bg-[var(--surface)] border-transparent md:bg-transparent md:border-[var(--border)] md:hover:border-[var(--foreground)]"
                }`}
              >
                <p className={`text-sm font-medium ${budget === b.label ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                  {b.label}
                </p>
                <p className={`text-[13px] md:text-xs mt-0.5 ${budget === b.label ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                  {b.range}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Save style */}
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <button
            onClick={onSaveStyle}
            disabled={styleSaving}
            className="w-full md:w-auto h-12 rounded-full flex items-center justify-center text-[15px] font-semibold md:h-auto md:inline-block md:text-xs md:tracking-[0.14em] md:uppercase md:font-medium md:rounded-xl md:px-8 md:py-4 text-[var(--background)] bg-[var(--foreground)] hover:opacity-80 transition-opacity duration-200 disabled:opacity-40"
          >
            {styleSaving ? "Saving..." : "Save style profile"}
          </button>
          {styleSaved && (
            <p className="text-center md:text-left text-[13px] md:text-xs text-[var(--foreground-muted)] animate-fade-in">Saved.</p>
          )}
        </div>
      </div>
    </div>
  );
}
