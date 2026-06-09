export const dynamic = "force-dynamic";

import Link from "next/link";
import FadeInView from "@/components/ui/FadeInView";
import { Layers, ScanSearch, ShoppingBag, Sparkles } from "lucide-react";
import { HeroSection } from "@/components/home/HeroSection";
import FeaturesBento from "@/components/home/FeaturesBento";
import OutfitExamplesCarousel from "@/components/home/OutfitExamplesCarousel";
import { getAllOutfits, getFeaturedOutfits } from "@/lib/data/db";
import JsonLd from "@/components/seo/JsonLd";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";

// ── DATA ─────────────────────────────────────────────────────────────────────

async function getData() {
  const [allOutfits, featuredForBento] = await Promise.all([
    getAllOutfits(),
    getFeaturedOutfits(),
  ]);
  return {
    allOutfits,
    bentoFeaturedOutfits: featuredForBento,
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
    <p className="text-[11px] tracking-[0.22em] uppercase font-medium mb-4 text-[var(--foreground-subtle)]">
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
      className={`text-4xl md:text-5xl lg:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] text-[var(--foreground)] ${
        centered ? "text-center" : ""
      }`}
    >
      {children}
    </h2>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

export default async function HomePage() {
  const { allOutfits, bentoFeaturedOutfits } = await getData();

  // Outfit examples: up to 9 so carousel has 3 full pages
  const carouselOutfits = allOutfits.slice(0, 9);

  return (
    <>
      {/* Structured data: Organization + WebSite (with sitelinks SearchAction) */}
      <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />

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
              <span className="absolute -right-3 -top-4 text-[120px] font-black tracking-[-0.06em] leading-none text-[var(--border)] select-none pointer-events-none transition-colors duration-300 group-hover:text-[var(--border-strong)]">
                {step.n}
              </span>
              <div className="relative z-10 w-10 h-10 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground-muted)] group-hover:border-[var(--foreground-muted)] transition-colors duration-300">
                {step.icon}
              </div>
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
        <FeaturesBento outfits={bentoFeaturedOutfits} />
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
        {carouselOutfits.length > 0 ? (
          <OutfitExamplesCarousel outfits={carouselOutfits} />
        ) : (
          <div className="py-20 text-center text-[var(--foreground-muted)] text-sm">
            No outfits yet —{" "}
            <Link href="/builder" className="underline">
              be the first to build one.
            </Link>
          </div>
        )}
      </Section>

    </>
  );
}
