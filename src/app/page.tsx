export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import OutfitCard from "@/components/outfit/OutfitCard";
import FadeInView from "@/components/ui/FadeInView";
import HeroProductCycle from "@/components/home/HeroProductCycle";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import type { Product, Outfit } from "@/lib/types";

// ── DATA ─────────────────────────────────────────────────────────────────────

async function getData() {
  const [allProducts, allOutfits] = await Promise.all([
    getAllProducts(),
    getAllOutfits(),
  ]);
  return {
    heroProducts: allProducts.slice(0, 8),
    bentoProducts: allProducts.slice(0, 6),
    shopProducts: allProducts.slice(0, 3),
    featuredOutfits: allOutfits.slice(0, 6),
    bentoOutfit: allOutfits[0] ?? null,
  };
}

// ── LAYOUT PRIMITIVES ────────────────────────────────────────────────────────

function Section({
  children,
  soft,
  className = "",
}: {
  children: React.ReactNode;
  soft?: boolean;
  className?: string;
}) {
  return (
    <section
      className={`py-24 md:py-32 ${soft ? "bg-[var(--surface)]" : "bg-[var(--background)]"} ${className}`}
    >
      <div className="max-w-[1280px] mx-auto px-6 md:px-12">{children}</div>
    </section>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.22em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
      {children}
    </p>
  );
}

function SectionH2({
  children,
  centered,
}: {
  children: React.ReactNode;
  centered?: boolean;
}) {
  return (
    <h2
      className={`text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] text-[var(--foreground)] leading-[1.04] ${centered ? "text-center" : ""}`}
    >
      {children}
    </h2>
  );
}

function Lede({
  children,
  maxWidth = "max-w-lg",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <p
      className={`mt-5 text-base md:text-[17px] leading-relaxed text-[var(--foreground-muted)] ${maxWidth}`}
    >
      {children}
    </p>
  );
}

// ── ICONS ────────────────────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M3 8H13M9 4L13 8L9 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── FEATURES BENTO ───────────────────────────────────────────────────────────

function FeaturesBento({
  products,
  outfit,
}: {
  products: Product[];
  outfit: Outfit | null;
}) {
  const p = (i: number) => products[i] ?? null;

  return (
    <div className="mt-14 grid grid-cols-12 gap-4 md:gap-5">

      {/* ── AI Preview hero card (8 cols) ── */}
      <FadeInView className="col-span-12 md:col-span-8 bg-[var(--foreground)] rounded-3xl p-8 flex flex-col min-h-[440px]">
        <div className="mb-5">
          <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-white/50 mb-3">
            Signature feature
          </p>
          <h3 className="text-2xl md:text-[30px] font-bold text-white leading-tight mb-2">
            AI Outfit Preview
          </h3>
          <p className="text-sm text-white/60 max-w-sm leading-relaxed">
            Generate realistic visuals of how your selected items look together — before you spend a cent.
          </p>
        </div>

        {/* Before → After — centered vertically */}
        <div className="flex-1 flex items-center gap-5">
          {/* Before: selected items grid */}
          <div className="flex-1 bg-white/[0.06] rounded-2xl p-4 border border-white/10 self-stretch flex flex-col">
            <p className="text-[9px] tracking-[0.15em] uppercase text-white/40 mb-3 shrink-0">
              Selected items
            </p>
            <div className="flex-1 grid grid-cols-3 gap-2 content-start">
              {[p(0), p(1), p(2), p(3), p(4), p(5)].map((prod, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg bg-white/[0.08] overflow-hidden"
                >
                  {prod?.imageUrl ? (
                    <Image
                      src={prod.imageUrl}
                      alt={prod.name ?? ""}
                      width={60}
                      height={60}
                      className="object-cover w-full h-full opacity-80"
                    />
                  ) : (
                    <div className="w-full h-full bg-white/10" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Arrow — centered */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 8H13M9 4L13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="text-[9px] text-white/30 uppercase tracking-widest">AI</p>
          </div>

          {/* After: outfit preview */}
          <div className="flex-1 bg-[var(--surface)] rounded-2xl overflow-hidden relative self-stretch">
            <span className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-full bg-[var(--background)] border border-[var(--border)] text-[9px] font-medium text-[var(--foreground)]">
              ✦ AI Preview
            </span>
            {outfit?.imageUrl ? (
              <Image
                src={outfit.imageUrl}
                alt={outfit.name ?? ""}
                fill
                className="object-cover"
                sizes="20vw"
              />
            ) : p(0)?.imageUrl ? (
              <Image
                src={p(0)!.imageUrl}
                alt={p(0)!.name ?? ""}
                fill
                className="object-cover opacity-70"
                sizes="20vw"
              />
            ) : (
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)]" />
            )}
            {outfit && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 pt-8">
                <p className="text-white text-[11px] font-semibold truncate">{outfit.name}</p>
              </div>
            )}
          </div>
        </div>
      </FadeInView>

      {/* ── AI Stylist (4 cols) ── */}
      <FadeInView delay={0.08} className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col min-h-[440px] border border-[var(--border)]">
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Chat-powered
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">AI Stylist</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed mb-5">
          Ask for outfit ideas, combinations and styling advice.
        </p>

        <div className="flex-1 flex flex-col justify-end gap-2.5">
          <div className="self-end bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] max-w-[88%] leading-snug">
            Something minimal for a gallery opening — black &amp; cream.
          </div>
          <div className="self-start bg-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tl-sm text-[13px] max-w-[90%] text-[var(--foreground)] leading-snug">
            On it. Starting with a longline wool coat and cream wide-leg trousers.
          </div>
          <div className="self-end bg-[var(--foreground)] text-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] max-w-[88%] leading-snug">
            Sounds good. What shoes?
          </div>
          <div className="self-start bg-[var(--background)] px-4 py-2.5 rounded-2xl rounded-tl-sm text-[13px] max-w-[90%] text-[var(--foreground)] leading-snug">
            Square-toe mule to keep the line sharp. Want to add a bag?
          </div>

          <div className="flex gap-2 mt-1 flex-wrap">
            {["Warmer", "Sharper", "Try a heel"].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[11px] text-[var(--foreground-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          <div className="h-10 border border-[var(--border)] rounded-full px-4 flex items-center justify-between mt-1">
            <span className="text-[12px] text-[var(--foreground-subtle)]">Message AI Stylist…</span>
            <span className="text-[11px] text-[var(--foreground-subtle)]">⏎</span>
          </div>
        </div>
      </FadeInView>

      {/* ── Outfit Builder (4 cols) ── */}
      <FadeInView className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col border border-[var(--border)] min-h-[340px]">
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Manual control
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Outfit Builder</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
          Create complete looks using real items from real brands.
        </p>
        <div className="flex-1 mt-5 bg-[var(--background)] rounded-2xl relative overflow-hidden min-h-[140px]">
          {p(1)?.imageUrl ? (
            <Image
              src={p(1)!.imageUrl}
              alt={p(1)!.name ?? ""}
              fill
              className="object-cover opacity-70"
              sizes="33vw"
            />
          ) : (
            <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,#D4CEC2_0px,#D4CEC2_7px,rgba(10,10,10,0.06)_7px,rgba(10,10,10,0.06)_8px)] opacity-50" />
          )}
          <div className="absolute bottom-3 left-3 right-3 bg-[var(--bg-overlay-90)] backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-[var(--foreground)] flex items-center justify-center shrink-0">
              <span className="text-[var(--background)] text-[11px] font-bold">+</span>
            </div>
            <span className="text-[12px] text-[var(--foreground)]">Add to outfit</span>
          </div>
        </div>
      </FadeInView>

      {/* ── Product Catalog (4 cols) ── */}
      <FadeInView delay={0.05} className="col-span-12 md:col-span-4 bg-[var(--surface)] rounded-3xl p-7 flex flex-col border border-[var(--border)] min-h-[340px]">
        <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
          Multi-brand
        </p>
        <h3 className="text-xl font-bold text-[var(--foreground)] mb-1">Product Catalog</h3>
        <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
          Explore items from hundreds of brands and online stores.
        </p>
        <div className="flex-1 mt-5 bg-[var(--background)] rounded-2xl p-3">
          <div className="grid grid-cols-3 gap-2">
            {[p(0), p(1), p(2), p(3), p(4), p(5)].map((prod, i) => (
              <div
                key={i}
                className="aspect-square rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
              >
                {prod?.imageUrl && (
                  <Image
                    src={prod.imageUrl}
                    alt={prod.name ?? ""}
                    width={60}
                    height={60}
                    className="object-cover w-full h-full"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </FadeInView>

      {/* ── Shop the Look (4 cols) ── */}
      <FadeInView delay={0.1} className="col-span-12 md:col-span-4 bg-[var(--foreground)] rounded-3xl p-7 flex flex-col min-h-[340px]">
        <p className="text-[10px] tracking-[0.22em] uppercase font-semibold text-white/50 mb-3">
          One-click shopping
        </p>
        <h3 className="text-xl font-bold text-white mb-1">Shop the Look</h3>
        <p className="text-[13px] text-white/60 leading-relaxed">
          Save outfits or open every product link in one clean flow.
        </p>
        <div className="flex-1 mt-5 flex flex-col justify-end gap-2">
          {[p(0), p(1), p(2)].map(
            (prod, i) =>
              prod && (
                <div
                  key={i}
                  className="bg-white/[0.09] rounded-xl px-4 py-3 flex justify-between items-center border border-white/10"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white truncate max-w-[130px]">
                      {prod.name}
                    </p>
                    <p className="text-[11px] text-white/50">{prod.brand}</p>
                  </div>
                  <p className="text-[13px] font-bold text-white shrink-0 ml-2">
                    ${prod.priceMin.toLocaleString()}
                  </p>
                </div>
              )
          )}
          <div className="bg-white text-[var(--foreground)] rounded-xl px-4 py-3 flex justify-between items-center mt-1">
            <span className="text-[13px] font-bold">Open all products</span>
            <ArrowRight />
          </div>
        </div>
      </FadeInView>

      {/* ── Community Looks (full width) ── */}
      <FadeInView className="col-span-12 bg-[var(--surface)] rounded-3xl p-8 border border-[var(--border)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-3">
              Inspiration
            </p>
            <h3 className="text-2xl md:text-[28px] font-bold text-[var(--foreground)] leading-tight mb-3">
              Community Looks
            </h3>
            <p className="text-[14px] text-[var(--foreground-muted)] leading-relaxed">
              Discover outfits created by other users — or generated by GOO — and remix them into your own.
            </p>
            <Link
              href="/browse"
              className="mt-6 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--foreground)] hover:opacity-70 transition-opacity"
            >
              Browse all looks <ArrowRight />
            </Link>
          </div>
          <div className="md:col-span-2 grid grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[3/4] rounded-2xl bg-[var(--background)] overflow-hidden relative"
              >
                <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[8px] font-bold text-[var(--foreground-subtle)]">
                  {i % 2 ? "◯" : "✦"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </FadeInView>
    </div>
  );
}

// ── AI STYLIST CHAT MOCKUP ────────────────────────────────────────────────────

function AIStylistMockup() {
  return (
    <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[var(--border)]">
        <div className="relative">
          <div className="w-9 h-9 rounded-full bg-[var(--foreground)] flex items-center justify-center text-[var(--background)] text-sm font-bold">
            G
          </div>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[var(--surface)]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">AI Stylist</p>
          <p className="text-[12px] text-[var(--foreground-muted)]">Online · ready to help</p>
        </div>
      </div>

      {/* Messages */}
      <div className="px-6 py-5 flex flex-col gap-3">
        {/* AI greeting */}
        <div className="flex">
          <div className="bg-[var(--background)] px-4 py-3 rounded-2xl rounded-tl-sm text-[13px] max-w-[85%] text-[var(--foreground)] leading-relaxed">
            Hey! Tell me the occasion, your style and budget — I&apos;ll build a complete outfit.
          </div>
        </div>

        {/* User */}
        <div className="flex justify-end">
          <div className="bg-[var(--foreground)] text-[var(--background)] px-4 py-3 rounded-2xl rounded-tr-sm text-[13px] max-w-[80%] leading-relaxed">
            Gallery opening. Black &amp; cream, minimal. Under $600.
          </div>
        </div>

        {/* AI response */}
        <div className="flex">
          <div className="bg-[var(--background)] px-4 py-3 rounded-2xl rounded-tl-sm text-[13px] max-w-[85%] text-[var(--foreground)] leading-relaxed">
            Perfect. Starting with a longline wool coat in matte black, paired with cream wide-leg trousers.
          </div>
        </div>

        {/* User follow-up */}
        <div className="flex justify-end">
          <div className="bg-[var(--foreground)] text-[var(--background)] px-4 py-3 rounded-2xl rounded-tr-sm text-[13px] max-w-[80%] leading-relaxed">
            What about shoes and accessories?
          </div>
        </div>

        {/* AI final */}
        <div className="flex flex-col gap-2">
          <div className="flex">
            <div className="bg-[var(--background)] px-4 py-3 rounded-2xl rounded-tl-sm text-[13px] max-w-[85%] text-[var(--foreground)] leading-relaxed">
              Square-toe leather mule and oval metal sunglasses. Total: ~$580. Want to adjust anything?
            </div>
          </div>
          {/* Item chips */}
          <div className="flex gap-2 ml-1">
            {["Coat · $310", "Trousers · $180", "Mule · $90"].map((label) => (
              <div
                key={label}
                className="px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] text-[11px] font-medium text-[var(--foreground-muted)]"
              >
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Quick replies */}
        <div className="flex gap-2 flex-wrap mt-1">
          {["Warmer", "Sharper", "Try a heel", "Add a bag"].map((tag) => (
            <span
              key={tag}
              className="px-3 py-1.5 rounded-full bg-[var(--background)] border border-[var(--border)] text-[11px] text-[var(--foreground-muted)] cursor-pointer hover:border-[var(--foreground-muted)] transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="px-6 pb-6">
        <div className="h-11 border border-[var(--border)] rounded-full px-4 flex items-center justify-between bg-[var(--background)]">
          <span className="text-[13px] text-[var(--foreground-subtle)]">Message AI Stylist…</span>
          <span className="text-[11px] text-[var(--foreground-subtle)]">⏎</span>
        </div>
      </div>
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { heroProducts, bentoProducts, shopProducts, featuredOutfits, bentoOutfit } =
    await getData();

  const totalPrice = heroProducts.reduce((s, p) => s + (p.priceMin || 0), 0);

  const brands = [
    "Acne Studios",
    "Balenciaga",
    "Fear of God",
    "Toteme",
    "Lemaire",
    "The Row",
    "Jil Sander",
    "Maison Margiela",
    "A.P.C.",
    "COS",
    "Arket",
    "Massimo Dutti",
  ];

  return (
    <>
      {/* ── HERO ── */}
      <section className="bg-[var(--background)] pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-[1280px] mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Left */}
            <FadeInView>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[13px] text-[var(--foreground)] mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                AI Fashion Assistant · Now in beta
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-[68px] font-bold tracking-[-0.04em] text-[var(--foreground)] leading-[1.02] mb-6">
                Build outfits from{" "}
                <span className="text-[var(--foreground-muted)] font-medium">
                  real products.
                </span>{" "}
                Visualize with AI.
              </h1>

              <p className="text-base md:text-[17px] leading-relaxed text-[var(--foreground-muted)] max-w-md mb-9">
                GOO helps you discover fashion items, combine them into full looks, generate AI outfit previews, and shop everything in one place.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-9">
                <Link
                  href="/builder"
                  className="bg-[var(--foreground)] text-[var(--background)] rounded-xl px-7 py-3.5 text-sm font-bold hover:opacity-90 transition-all text-center"
                >
                  Start building an outfit
                </Link>
                <Link
                  href="/stylist"
                  className="border border-[var(--border-strong)] text-[var(--foreground)] rounded-xl px-7 py-3.5 text-sm font-semibold hover:border-[var(--foreground)] transition-all text-center"
                >
                  Try AI Stylist
                </Link>
              </div>

              <div className="flex flex-wrap gap-5 text-sm text-[var(--foreground-muted)]">
                {["1,200+ brands", "AI styling", "Real shop links"].map((stat) => (
                  <span key={stat} className="flex items-center gap-2">
                    <CheckIcon />
                    {stat}
                  </span>
                ))}
              </div>
            </FadeInView>

            {/* Right — animated product cycle */}
            <FadeInView delay={0.12}>
              <HeroProductCycle products={heroProducts} totalPrice={totalPrice} />
            </FadeInView>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <Section soft>
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <Kicker>How it works</Kicker>
            <SectionH2>Four simple steps to a finished look.</SectionH2>
          </div>
          <Link
            href="/builder"
            className="bg-[var(--foreground)] text-[var(--background)] rounded-xl px-6 py-3 text-sm font-bold hover:opacity-90 transition-all shrink-0 text-center"
          >
            Try the builder
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { n: "01", title: "Choose items", body: "Select clothes, shoes and accessories from the GOO catalog — hundreds of premium brands." },
            { n: "02", title: "Build your look", body: "Add items into outfit slots and create a complete combination that actually works." },
            { n: "03", title: "Generate a preview", body: "Use AI to visualize your outfit as a full-body fashion look before you buy." },
            { n: "04", title: "Shop the products", body: "Open product links and buy each piece from the original store at the best price." },
          ].map((step, i) => (
            <FadeInView
              key={step.n}
              delay={i * 0.07}
              className="bg-[var(--background)] rounded-2xl p-8 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-200 flex flex-col gap-8"
            >
              <p className="text-[11px] tracking-[0.22em] text-[var(--foreground-subtle)] font-bold">
                {step.n}
              </p>
              <div>
                <h3 className="text-[18px] font-semibold text-[var(--foreground)] mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{step.body}</p>
              </div>
            </FadeInView>
          ))}
        </div>
      </Section>

      {/* ── FEATURES BENTO ── */}
      <Section>
        <FadeInView>
          <Kicker>Features</Kicker>
          <SectionH2>Everything you need to create better outfits.</SectionH2>
        </FadeInView>
        <FeaturesBento products={bentoProducts} outfit={bentoOutfit} />
      </Section>

      {/* ── USE CASES ── */}
      <Section soft>
        <FadeInView className="max-w-2xl mb-12">
          <Kicker>Use cases</Kicker>
          <SectionH2>Made for people who want to dress better — without wasting time.</SectionH2>
        </FadeInView>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              ),
              title: "Everyday outfits",
              body: "Quickly build casual looks for daily wear without spending hours searching different stores.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" />
                </svg>
              ),
              title: "Events",
              body: "Outfits for dates, parties, work, travel and special occasions — perfectly assembled in minutes.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><path d="M3 6h18M16 10a4 4 0 01-8 0" />
                </svg>
              ),
              title: "Shopping decisions",
              body: "Check if items actually match before you spend — see the full look, not single product photos.",
            },
            {
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
              ),
              title: "Inspiration",
              body: "New combinations instead of endless scrolling through single product pages with no context.",
            },
          ].map((c, i) => (
            <FadeInView
              key={c.title}
              delay={i * 0.07}
              className="bg-[var(--background)] rounded-2xl p-7 border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors duration-200"
            >
              <div className="w-11 h-11 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)] mb-5">
                {c.icon}
              </div>
              <h3 className="text-[17px] font-semibold text-[var(--foreground)] mb-2">{c.title}</h3>
              <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{c.body}</p>
            </FadeInView>
          ))}
        </div>
      </Section>

      {/* ── AI STYLIST ── */}
      <Section>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-20 items-start">
          <FadeInView>
            <Kicker>AI Stylist</Kicker>
            <SectionH2>
              Not sure what to wear?{" "}
              <span className="text-[var(--foreground-muted)] font-medium">Ask the AI.</span>
            </SectionH2>
            <Lede>
              Tell GOO what you need — style, occasion, weather, budget or preferred brands. The AI Stylist suggests outfit ideas, explains combinations and helps you improve your look.
            </Lede>
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                "Create a minimal outfit for a summer evening.",
                "Style these sneakers with casual clothes.",
                "Find me a black-and-white outfit under $300.",
                "Make this outfit look more premium.",
              ].map((prompt) => (
                <div
                  key={prompt}
                  className="px-4 py-2.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[13px] text-[var(--foreground)]"
                >
                  &ldquo;{prompt}&rdquo;
                </div>
              ))}
            </div>
            <Link
              href="/stylist"
              className="mt-8 inline-block bg-[var(--foreground)] text-[var(--background)] rounded-xl px-7 py-3.5 text-sm font-bold hover:opacity-90 transition-all"
            >
              Try AI Stylist
            </Link>
          </FadeInView>

          <FadeInView delay={0.1}>
            <AIStylistMockup />
          </FadeInView>
        </div>
      </Section>

      {/* ── OUTFIT EXAMPLES ── */}
      <Section soft>
        <FadeInView className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div>
            <Kicker>Outfit examples</Kicker>
            <SectionH2>Explore ready-made outfit ideas.</SectionH2>
          </div>
          <Link
            href="/browse"
            className="text-sm text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-4 shrink-0"
          >
            Browse all outfits
          </Link>
        </FadeInView>

        {featuredOutfits.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
            {featuredOutfits.map((outfit: Outfit) => (
              <OutfitCard key={outfit.id} outfit={outfit} />
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-[var(--foreground-muted)] text-sm">
            No outfits yet —{" "}
            <Link href="/builder" className="underline">be the first to build one.</Link>
          </div>
        )}
      </Section>

      {/* ── WHY DIFFERENT ── */}
      <Section>
        <FadeInView className="max-w-2xl mb-12">
          <Kicker>Why GOO is different</Kicker>
          <SectionH2>More than another fashion store.</SectionH2>
        </FadeInView>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FadeInView className="bg-[var(--surface)] rounded-3xl p-9 border border-[var(--border)]">
            <p className="text-[11px] tracking-[0.2em] uppercase font-semibold text-[var(--foreground-subtle)] mb-7">
              Regular fashion store
            </p>
            {[
              "Single products only",
              "Many separate tabs to manage",
              "No outfit preview before buying",
              "Limited styling help",
            ].map((it) => (
              <div key={it} className="flex items-center gap-3 py-4 border-t border-[var(--border)]">
                <span className="text-[var(--foreground-subtle)]"><CrossIcon /></span>
                <span className="text-[15px] text-[var(--foreground-muted)]">{it}</span>
              </div>
            ))}
          </FadeInView>

          <FadeInView delay={0.08} className="bg-[var(--foreground)] rounded-3xl p-9">
            <p className="text-[11px] tracking-[0.2em] uppercase font-bold text-white/50 mb-7">GOO</p>
            {[
              "Complete outfit building",
              "All brands in one place",
              "AI styling help built in",
              "Visual outfit previews before buying",
            ].map((it) => (
              <div key={it} className="flex items-center gap-3 py-4 border-t border-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                  <path d="M5 12.5l5 5 9-11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-[15px] text-white">{it}</span>
              </div>
            ))}
          </FadeInView>
        </div>
      </Section>

      {/* ── BRAND MARQUEE ── */}
      <section className="border-t border-[var(--border)] py-6 overflow-hidden bg-[var(--background)]">
        <div
          className="flex gap-14 whitespace-nowrap"
          style={{ animation: "marquee 40s linear infinite" }}
        >
          {Array(2)
            .fill(brands)
            .flat()
            .map((brand, i) => (
              <span key={i} className="inline-flex items-center gap-2">
                <span className="text-[11px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)]">
                  {brand}
                </span>
                <span className="text-[var(--foreground-subtle)]/30 mx-2">·</span>
              </span>
            ))}
        </div>
      </section>

      {/* ── EARLY ACCESS ── */}
      <Section>
        <FadeInView>
          <div className="bg-[#F1ECE2] dark:bg-[#1A1810] rounded-3xl px-12 md:px-20 py-16 md:py-20 relative overflow-hidden">
            <div className="absolute right-[-60px] top-[-60px] w-[360px] h-[360px] rounded-full bg-white/40 pointer-events-none" />
            <div className="relative max-w-xl">
              <Kicker>Early access</Kicker>
              <SectionH2>Built for the next way of shopping fashion.</SectionH2>
              <Lede maxWidth="max-w-sm">
                GOO is in active development. We are building a smarter way to discover, combine and shop fashion online.
              </Lede>
              <div className="mt-7 flex flex-wrap gap-2">
                {["AI outfit generation", "Real product catalog", "Personal styling assistant", "Smart outfit builder"].map((f) => (
                  <span key={f} className="px-3.5 py-2 rounded-full bg-white border border-[var(--border)] text-[13px] font-medium text-[var(--foreground)]">
                    {f}
                  </span>
                ))}
              </div>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link href="/register" className="bg-[var(--foreground)] text-[var(--background)] rounded-xl px-7 py-3.5 text-sm font-bold hover:opacity-90 transition-all text-center">
                  Join early access
                </Link>
                <Link href="/builder" className="border border-[var(--border-strong)] text-[var(--foreground)] rounded-xl px-7 py-3.5 text-sm font-semibold hover:border-[var(--foreground)] transition-all text-center bg-white/50">
                  Try the beta
                </Link>
              </div>
            </div>
          </div>
        </FadeInView>
      </Section>

      {/* ── FINAL CTA ── */}
      <Section className="pb-8">
        <FadeInView className="text-center max-w-2xl mx-auto">
          <SectionH2 centered>
            Start building your next{" "}
            <span className="text-[var(--foreground-muted)] font-medium">outfit</span>{" "}
            with GOO.
          </SectionH2>
          <p className="mt-5 text-base md:text-[17px] text-[var(--foreground-muted)] leading-relaxed">
            Explore products, create full looks and let AI help you style them better.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/builder" className="bg-[var(--foreground)] text-[var(--background)] rounded-xl px-8 py-3.5 text-sm font-bold hover:opacity-90 transition-all">
              Start building
            </Link>
            <Link href="/stylist" className="border border-[var(--border-strong)] text-[var(--foreground)] rounded-xl px-8 py-3.5 text-sm font-semibold hover:border-[var(--foreground)] transition-all">
              Try AI Stylist
            </Link>
          </div>
        </FadeInView>
      </Section>
    </>
  );
}
