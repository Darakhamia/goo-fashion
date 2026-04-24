"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useAuth } from "@/lib/context/auth-context";
import { useTheme } from "@/lib/context/theme-context";
import Link from "next/link";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";

// ── Types ──────────────────────────────────────────────────────────────────────
type Tab = "account" | "plan" | "stylist";
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

export interface StylistPersonalization {
  nickname: string;
  pronouns: string;
  styleGoals: string[];
  hardLimits: string;
  lifestyle: string;
}

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

const STYLE_GOALS = [
  "Look polished",
  "Express creativity",
  "Feel comfortable",
  "Stay on-trend",
  "Be sustainable",
  "Look effortless",
  "Make a statement",
];

const LIFESTYLE_OPTIONS = [
  { id: "casual", label: "Mostly casual", desc: "Weekends, relaxed outings" },
  { id: "mixed", label: "Mixed casual & formal", desc: "Variety through the week" },
  { id: "professional", label: "Mostly professional", desc: "Office-first wardrobe" },
  { id: "active", label: "Active / sporty", desc: "Movement is part of the day" },
  { id: "creative", label: "Creative environment", desc: "Art, fashion, design world" },
];

const PRONOUNS_OPTIONS = ["she/her", "he/him", "they/them", "Skip"];

const PLAN_FEATURE_LABELS: Record<string, string> = {
  aiStylist: "AI Stylist chat",
  imageGeneration: "Outfit image generation",
  saveOutfits: "Save outfits",
  stylistMemory: "Stylist memory",
  exclusiveStyles: "Exclusive styles",
};

const ALL_FEATURES = ["aiStylist", "imageGeneration", "saveOutfits", "stylistMemory", "exclusiveStyles"];

// ── Helpers ────────────────────────────────────────────────────────────────────
function nextBillingDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function fakeBillingHistory(plan: PlanId): { date: string; amount: number; label: string }[] {
  if (plan === "free") return [];
  const price = PLANS[plan].price;
  const name = PLANS[plan].name;
  const history = [];
  const now = new Date();
  for (let i = 0; i < 3; i++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - i);
    history.push({
      date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      amount: price,
      label: name,
    });
  }
  return history;
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user } = useAuth();
  const { user: clerkUser, isLoaded } = useUser();
  const { theme, toggleTheme } = useTheme();

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
    { id: "plan", label: "Plan" },
    { id: "stylist", label: "AI Stylist" },
  ];

  if (!isLoaded) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <div className="w-4 h-4 border border-[var(--foreground)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-12 md:pt-16">

          {/* Header */}
          <div className="mb-10 animate-fade-up">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Profile
            </p>
            <h1 className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)]">
              {user?.name ?? "Your profile."}
            </h1>
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-[var(--border)] mb-10 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 text-[10px] tracking-[0.16em] uppercase font-medium transition-colors duration-200 border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[var(--foreground)] text-[var(--foreground)]"
                    : "border-transparent text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
                {tab.id === "stylist" && stylistPersonalization && (
                  <span className="ml-2 w-1.5 h-1.5 rounded-full bg-[var(--foreground)] inline-block align-middle" />
                )}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="max-w-2xl pb-20">
            {activeTab === "account" && (
              <AccountTab user={user} clerkUser={clerkUser} theme={theme} toggleTheme={toggleTheme} />
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
          </div>
        </div>
      </div>

      {showStylistModal && (
        <StylistCustomizeModal
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
  theme,
  toggleTheme,
}: {
  user: { name: string; email: string; plan: PlanId; avatar?: string; joinedAt: string } | null;
  clerkUser: ReturnType<typeof useUser>["user"];
  theme: string;
  toggleTheme: () => void;
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
      <div className="p-4 border border-[var(--border)] flex items-center justify-between">
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

      {/* Appearance */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
          Appearance
        </p>
        <div className="flex items-center justify-between p-5 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-200">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              {theme === "dark" ? "Dark mode" : "Light mode"}
            </p>
            <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
              {theme === "dark" ? "Easy on the eyes, GOO's default" : "Optimised for bright environments"}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className={`relative w-11 h-6 rounded-full transition-colors duration-300 shrink-0 ${
              theme === "dark" ? "bg-[var(--foreground)]" : "bg-[var(--border-strong)]"
            }`}
          >
            <span
              className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 bg-[var(--background)] ${
                theme === "dark" ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Session */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
          Session
        </p>
        <button
          onClick={logout}
          className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] px-6 py-3 hover:border-[var(--foreground)] hover:text-[var(--foreground)] transition-all duration-200"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ── Plan Tab ───────────────────────────────────────────────────────────────────
function PlanTab({ currentPlan }: { currentPlan: PlanId }) {
  const isPaid = currentPlan !== "free";
  const billingHistory = fakeBillingHistory(currentPlan);

  return (
    <div className="animate-fade-up space-y-10">

      {/* Current plan card */}
      <div>
        <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
          Current plan
        </p>
        <div className="p-6 border border-[var(--foreground)]">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-2xl font-light text-[var(--foreground)] capitalize">
                {PLANS[currentPlan].name}
              </p>
              <p className="text-xs text-[var(--foreground-muted)] mt-1">
                {PLANS[currentPlan].price === 0 ? "Free forever" : `$${PLANS[currentPlan].price} / month`}
              </p>
            </div>
            {currentPlan !== "premium" && (
              <Link
                href="/plans"
                className="text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-5 py-2.5 hover:opacity-80 transition-opacity"
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
            <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs text-[var(--foreground-muted)]">Next payment</p>
                <p className="text-xs font-medium text-[var(--foreground)]">
                  ${PLANS[currentPlan].price}.00 on {nextBillingDate()}
                </p>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs text-[var(--foreground-muted)]">Billing cycle</p>
                <p className="text-xs font-medium text-[var(--foreground)]">Monthly</p>
              </div>
              <div className="flex items-center justify-between px-5 py-4">
                <p className="text-xs text-[var(--foreground-muted)]">Payment method</p>
                <p className="text-xs font-medium text-[var(--foreground)] flex items-center gap-2">
                  <span className="text-[var(--foreground-subtle)] tracking-widest">••••</span>
                  4242
                  <span className="text-[9px] tracking-[0.10em] uppercase text-[var(--foreground-subtle)] border border-[var(--border)] px-1.5 py-0.5">
                    demo
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Billing history */}
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
              Billing history
            </p>
            <div className="border border-[var(--border)] divide-y divide-[var(--border)]">
              {billingHistory.map((entry, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-xs text-[var(--foreground)]">{entry.label} plan</p>
                    <p className="text-[10px] text-[var(--foreground-subtle)] mt-0.5">{entry.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-[var(--foreground)]">${entry.amount}.00</p>
                    <p className="text-[9px] tracking-[0.10em] uppercase text-green-600 dark:text-green-400 mt-0.5">paid</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Cancel */}
          <div className="pt-2">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-5">
              Manage
            </p>
            <div className="flex flex-col gap-3">
              <Link
                href="/plans"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-6 py-3 hover:border-[var(--foreground)] transition-colors duration-200 text-center"
              >
                Change plan
              </Link>
              <button className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] border border-[var(--border)] px-6 py-3 hover:border-[var(--foreground-muted)] transition-colors duration-200">
                Cancel subscription
              </button>
            </div>
            <p className="text-[10px] text-[var(--foreground-subtle)] mt-4">
              Billing is currently in demo mode — no actual charges are made.
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
                  <div key={planId} className="p-4 border border-[var(--border)]">
                    <p className="text-xs font-medium text-[var(--foreground)] capitalize">{plan.name}</p>
                    <p className="text-[10px] text-[var(--foreground-muted)] mt-1 mb-3">${plan.price}/mo</p>
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
            <div className="p-5 border border-[var(--border)] space-y-4">
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
                      <span key={g} className="text-[10px] tracking-[0.08em] border border-[var(--border)] px-2.5 py-1 text-[var(--foreground-muted)]">
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
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-6 py-3 hover:border-[var(--foreground)] transition-colors duration-200"
            >
              Edit personalization
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="p-6 border border-dashed border-[var(--border)]">
              <p className="text-sm font-medium text-[var(--foreground)] mb-2">Not yet personalized</p>
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                2 minutes. Makes every AI recommendation significantly more personal.
              </p>
            </div>
            <button
              onClick={onCustomize}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
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
                  className={`group relative aspect-square transition-all duration-200 ${
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
                  <span key={hex} className="flex items-center gap-1.5 text-[9px] tracking-[0.08em] uppercase text-[var(--foreground-muted)] border border-[var(--border)] px-2 py-1">
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
                className={`text-[10px] tracking-[0.12em] uppercase font-medium px-4 py-2 border transition-all duration-200 ${
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-[var(--border)]">
            {BODY_TYPES.map((bt) => (
              <button
                key={bt.id}
                onClick={() => setBodyType(bt.id)}
                className={`p-5 text-left transition-colors duration-200 ${
                  bodyType === bt.id ? "bg-[var(--foreground)]" : "bg-[var(--background)] hover:bg-[var(--surface)]"
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
                  className="w-full bg-transparent border border-[var(--border)] text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-200"
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
                className={`p-4 text-left border transition-all duration-200 ${
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
            className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200 disabled:opacity-40"
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

// ── AI Stylist Customization Modal ─────────────────────────────────────────────
function StylistCustomizeModal({
  initial,
  userName,
  onClose,
  onSave,
}: {
  initial: StylistPersonalization | null;
  userName: string;
  onClose: () => void;
  onSave: (data: StylistPersonalization) => Promise<void>;
}) {
  const TOTAL_STEPS = 5;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [nickname, setNickname] = useState(initial?.nickname ?? userName ?? "");
  const [pronouns, setPronouns] = useState(initial?.pronouns ?? "");
  const [styleGoals, setStyleGoals] = useState<string[]>(initial?.styleGoals ?? []);
  const [hardLimits, setHardLimits] = useState(initial?.hardLimits ?? "");
  const [lifestyle, setLifestyle] = useState(initial?.lifestyle ?? "");

  const toggleGoal = (g: string) => {
    setStyleGoals((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  };

  const canProceed = () => {
    if (step === 1) return styleGoals.length > 0;
    if (step === 3) return !!lifestyle;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ nickname, pronouns, styleGoals, hardLimits, lifestyle });
    } finally {
      setSaving(false);
    }
  };

  const STEP_TITLES = [
    "What should we call you?",
    "What are your style goals?",
    "What should GOO never suggest?",
    "What's your typical lifestyle?",
    "You're all set.",
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[var(--background)]/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[var(--background)] border border-[var(--border)] w-full max-w-lg p-8 animate-fade-up shadow-2xl">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[var(--foreground-subtle)] hover:text-[var(--foreground)] transition-colors p-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>

        {/* Progress */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-0.5 flex-1 transition-colors duration-300 ${i <= step ? "bg-[var(--foreground)]" : "bg-[var(--border)]"}`}
            />
          ))}
        </div>

        <p className="text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-3">
          Step {step + 1} of {TOTAL_STEPS}
        </p>
        <h2 className="font-display text-2xl font-light text-[var(--foreground)] mb-6">
          {STEP_TITLES[step]}
        </h2>

        <div className="min-h-[200px]">
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <label className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] block mb-2">
                  Name or nickname
                </label>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Your name or nickname"
                  autoFocus
                  className="w-full bg-transparent border border-[var(--border)] text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-200"
                />
              </div>
              <div>
                <label className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] block mb-3">
                  Pronouns
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRONOUNS_OPTIONS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPronouns(p === pronouns ? "" : p)}
                      className={`text-[10px] tracking-[0.10em] uppercase px-4 py-2 border transition-all duration-200 ${
                        pronouns === p
                          ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                          : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <p className="text-xs text-[var(--foreground-muted)] mb-5">
                Select everything that matters to you.
              </p>
              <div className="flex flex-wrap gap-2">
                {STYLE_GOALS.map((g) => (
                  <button
                    key={g}
                    onClick={() => toggleGoal(g)}
                    className={`text-[10px] tracking-[0.10em] uppercase px-4 py-2.5 border transition-all duration-200 ${
                      styleGoals.includes(g)
                        ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                        : "border-[var(--border)] text-[var(--foreground-muted)] hover:border-[var(--foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">
                Be as specific as you like. GOO will never suggest these.
              </p>
              <textarea
                value={hardLimits}
                onChange={(e) => setHardLimits(e.target.value)}
                placeholder="e.g. no animal prints, nothing too revealing, avoid fast fashion brands..."
                rows={5}
                className="w-full bg-transparent border border-[var(--border)] text-sm text-[var(--foreground)] px-4 py-3 placeholder-[var(--foreground-subtle)] focus:outline-none focus:border-[var(--foreground)] transition-colors duration-200 resize-none"
              />
              <p className="text-[10px] text-[var(--foreground-subtle)]">Optional — skip if nothing applies.</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-2">
              {LIFESTYLE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setLifestyle(opt.id)}
                  className={`w-full p-4 text-left border transition-all duration-200 flex items-center justify-between ${
                    lifestyle === opt.id
                      ? "border-[var(--foreground)] bg-[var(--foreground)]"
                      : "border-[var(--border)] hover:border-[var(--foreground-subtle)]"
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${lifestyle === opt.id ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                      {opt.label}
                    </p>
                    <p className={`text-xs mt-0.5 ${lifestyle === opt.id ? "text-[var(--fg-on-dark-60)]" : "text-[var(--foreground-muted)]"}`}>
                      {opt.desc}
                    </p>
                  </div>
                  {lifestyle === opt.id && (
                    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" className="shrink-0 ml-3">
                      <path d="M1 5.5L5 9.5L13 1" stroke="var(--background)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                GOO&apos;s AI stylist is personalized to you. These preferences are applied to every recommendation.
              </p>
              <div className="p-4 border border-[var(--border)] space-y-3">
                {nickname && (
                  <p className="text-xs text-[var(--foreground-muted)]">
                    <span className="text-[var(--foreground-subtle)] mr-2">Name:</span>
                    <span className="text-[var(--foreground)]">{nickname}</span>
                    {pronouns && pronouns !== "Skip" && (
                      <span className="text-[var(--foreground-muted)] ml-1">({pronouns})</span>
                    )}
                  </p>
                )}
                {styleGoals.length > 0 && (
                  <div>
                    <p className="text-xs text-[var(--foreground-subtle)] mb-1.5">Goals:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {styleGoals.map((g) => (
                        <span key={g} className="text-[10px] tracking-[0.08em] border border-[var(--border)] px-2.5 py-1 text-[var(--foreground-muted)]">
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {lifestyle && (
                  <p className="text-xs text-[var(--foreground-muted)]">
                    <span className="text-[var(--foreground-subtle)] mr-2">Lifestyle:</span>
                    <span className="text-[var(--foreground)]">
                      {LIFESTYLE_OPTIONS.find((o) => o.id === lifestyle)?.label}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border)]">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors"
          >
            {step === 0 ? "Cancel" : "← Back"}
          </button>

          {step < TOTAL_STEPS - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-30"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-6 py-3 hover:opacity-80 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save & finish"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
