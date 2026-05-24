export const dynamic = "force-dynamic";

import Link from "next/link";
import Image from "next/image";
import OutfitCard from "@/components/outfit/OutfitCard";
import FadeInView from "@/components/ui/FadeInView";
import { Layers, ScanSearch, ShoppingBag, Sparkles } from "lucide-react";
import { HeroSection } from "@/components/home/HeroSection";
import { AIStylistChat } from "@/components/home/AIStylistChat";
import FeaturesBento from "@/components/home/FeaturesBento";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import type { Outfit } from "@/lib/types";

// ── DATA ─────────────────────────────────────────────────────────────────────

async function getData() {
  const [allProducts, allOutfits] = await Promise.all([
    getAllProducts(),
    getAllOutfits(),
  ]);
  return {
    bentoProducts: allProducts.slice(0, 6),
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

function Kicker({ children, light }: { children: React.ReactNode; light?: boolean }) {
  return (
    <p
      className={`text-[11px] tracking-[0.22em] uppercase font-medium mb-4 ${
        light ? "text-white/40" : "text-[var(--foreground-subtle)]"
      }`}
    >
      {children}
    </p>
  );
}

function SectionH2({
  children,
  centered,
  light,
}: {
  children: React.ReactNode;
  centered?: boolean;
  light?: boolean;
}) {
  return (
    <h2
      className={`text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] ${
        centered ? "text-center" : ""
      } ${light ? "text-white" : "text-[var(--foreground)]"}`}
    >
      {children}
    </h2>
  );
}

function Lede({
  children,
  maxWidth = "max-w-lg",
  light,
}: {
  children: React.ReactNode;
  maxWidth?: string;
  light?: boolean;
}) {
  return (
    <p
      className={`mt-5 text-base md:text-[17px] leading-relaxed ${maxWidth} ${
        light ? "text-white/60" : "text-[var(--foreground-muted)]"
      }`}
    >
      {children}
    </p>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { bentoProducts, featuredOutfits, bentoOutfit } = await getData();

  return (
    <>
      {/* ── HERO ── */}
      <HeroSection />

      {/* ── HOW IT WORKS ── */}
      <Section soft>
        <FadeInView className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <Kicker>How it works</Kicker>
            <SectionH2>Four steps to a finished look.</SectionH2>
          </div>
          <Link
            href="/builder"
            className="text-sm font-semibold text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors underline underline-offset-4 shrink-0"
          >
            Try the builder →
          </Link>
        </FadeInView>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border)] rounded-3xl overflow-hidden">
          {[
            {
              n: "01", icon: <ShoppingBag size={18} strokeWidth={1.5} />,
              title: "Choose items",
              body: "Browse hundreds of premium brands and pick clothes, shoes and accessories.",
            },
            {
              n: "02", icon: <Layers size={18} strokeWidth={1.5} />,
              title: "Build your look",
              body: "Drop items into outfit slots and craft combinations that actually work.",
            },
            {
              n: "03", icon: <Sparkles size={18} strokeWidth={1.5} />,
              title: "Generate a preview",
              body: "Visualize the full-body look with AI — before you spend a single dollar.",
            },
            {
              n: "04", icon: <ScanSearch size={18} strokeWidth={1.5} />,
              title: "Shop the products",
              body: "Open direct links and buy each piece from the original store at the best price.",
            },
          ].map((step, i) => (
            <FadeInView
              key={step.n}
              delay={i * 0.08}
              className="relative bg-[var(--surface)] p-8 flex flex-col gap-6 overflow-hidden group hover:bg-[var(--background)] transition-colors duration-300"
            >
              {/* Watermark number */}
              <span className="absolute -right-3 -top-4 text-[120px] font-black tracking-[-0.06em] leading-none text-[var(--border)] select-none pointer-events-none transition-colors duration-300 group-hover:text-[var(--border-strong)]">
                {step.n}
              </span>

              {/* Icon badge */}
              <div className="relative z-10 w-10 h-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] group-hover:border-[var(--foreground-muted)] transition-colors duration-300">
                {step.icon}
              </div>

              {/* Text */}
              <div className="relative z-10">
                <h3 className="text-[16px] font-semibold text-[var(--foreground)] mb-2 leading-snug">
                  {step.title}
                </h3>
                <p className="text-[13px] text-[var(--foreground-muted)] leading-relaxed">
                  {step.body}
                </p>
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

      {/* ── AI STYLIST ── */}
      <Section soft>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 md:gap-20 items-center">
          <FadeInView>
            <Kicker>AI Stylist</Kicker>
            <SectionH2>
              Not sure what to wear?{" "}
              <span className="text-[var(--foreground-muted)] font-medium">
                Just ask.
              </span>
            </SectionH2>
            <p className="mt-4 text-[var(--foreground-muted)] text-lg leading-relaxed max-w-sm">
              Describe your occasion and budget — GOO builds the complete outfit.
            </p>
            <Link
              href="/stylist"
              className="mt-8 inline-block bg-[var(--foreground)] text-[var(--background)] rounded-xl px-7 py-3.5 text-sm font-bold hover:opacity-90 transition-all"
            >
              Try AI Stylist
            </Link>
          </FadeInView>
          <FadeInView delay={0.1}>
            <AIStylistChat />
          </FadeInView>
        </div>
      </Section>

      {/* ── OUTFIT EXAMPLES ── */}
      <Section>
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
            <Link href="/builder" className="underline">
              be the first to build one.
            </Link>
          </div>
        )}
      </Section>

      {/* ── CTA ── */}
      <Section soft className="pb-8">
        <FadeInView>
          <div className="bg-[var(--foreground)] rounded-3xl px-12 md:px-20 py-16 md:py-24 relative overflow-hidden">
            <div className="absolute right-[-80px] top-[-80px] w-[420px] h-[420px] rounded-full bg-white/[0.04] pointer-events-none" />
            <div className="absolute right-[60px] bottom-[-80px] w-[260px] h-[260px] rounded-full bg-white/[0.03] pointer-events-none" />
            <div className="relative max-w-xl">
              <Kicker light>Early access</Kicker>
              <SectionH2 light>
                Start dressing smarter.
              </SectionH2>
              <Lede light maxWidth="max-w-sm">
                GOO is in active development. Join early and help shape the future of AI-powered fashion.
              </Lede>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/register"
                  className="bg-white text-[var(--foreground)] rounded-xl px-7 py-3.5 text-sm font-bold hover:opacity-90 transition-all text-center"
                >
                  Join early access
                </Link>
                <Link
                  href="/builder"
                  className="border border-white/20 text-white rounded-xl px-7 py-3.5 text-sm font-semibold hover:border-white/40 transition-all text-center"
                >
                  Try the beta
                </Link>
              </div>
            </div>
          </div>
        </FadeInView>
      </Section>
    </>
  );
}
