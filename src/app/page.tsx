export const dynamic = "force-dynamic";

import Link from "next/link";
import ProductCard from "@/components/product/ProductCard";
import SectionLabel from "@/components/ui/SectionLabel";
import HeroBackground from "@/components/ui/HeroBackground";
import FadeInView from "@/components/ui/FadeInView";
import HowItWorksGrid from "@/components/home/HowItWorksGrid";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import OutfitCarousel from "@/components/outfit/OutfitCarousel";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?q=80&w=2069&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

async function getHeroImages(): Promise<{ darkUrl: string; lightUrl: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { darkUrl: DEFAULT_HERO, lightUrl: DEFAULT_HERO };
  }
  try {
    const { data: rows } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["hero_image_url", "hero_image_url_light"]);
    const byKey = Object.fromEntries(
      (rows ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
    );
    return {
      darkUrl: byKey["hero_image_url"] ?? DEFAULT_HERO,
      lightUrl: byKey["hero_image_url_light"] ?? DEFAULT_HERO,
    };
  } catch {
    return { darkUrl: DEFAULT_HERO, lightUrl: DEFAULT_HERO };
  }
}

export default async function HomePage() {
  const [allProducts, allOutfits, heroImages] = await Promise.all([
    getAllProducts(),
    getAllOutfits(),
    getHeroImages(),
  ]);
  const featuredOutfits = allOutfits.slice(0, 12);
  const featuredProducts = allProducts.slice(0, 4);

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col justify-end pb-20 md:pb-28 pt-32 rounded-2xl overflow-hidden mx-6 md:mx-12 mt-4">
        <HeroBackground darkUrl={heroImages.darkUrl} lightUrl={heroImages.lightUrl} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/90 via-[#0A0A0A]/30 to-transparent" />

        {/* Floating pill tag */}
        <div className="absolute top-6 right-6 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-[11px] text-white/80 font-medium tracking-wide z-10">
          AI-Powered Styling
        </div>

        <div className="relative z-10 max-w-[1440px] mx-auto px-6 md:px-12 w-full">
          <div className="max-w-2xl">
            <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-white/50 mb-6">
              AI Stylist · Personal Wardrobe
            </p>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black uppercase text-white leading-[0.95] tracking-tight mb-8">
              Dress like
              <br />
              <em>you think.</em>
            </h1>
            <p className="text-sm md:text-base text-white/60 leading-relaxed max-w-md mb-12">
              AI builds complete outfits around your style, body, and budget.
              Premium brands, price-compared.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/stylist"
                className="bg-white text-black rounded-xl px-8 py-3.5 text-sm font-bold hover:bg-white/90 transition-all"
              >
                Generate Outfit
              </Link>
              <Link
                href="/browse"
                className="border border-white/40 text-white rounded-xl px-8 py-3.5 text-sm font-semibold hover:border-white/80 transition-all"
              >
                Browse
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── OUTFITS CAROUSEL ─── */}
      <div className="max-w-[1440px] mx-auto px-6 md:px-12 mt-16 md:mt-24">
        <OutfitCarousel outfits={featuredOutfits} />
      </div>

      {/* ─── AI STYLIST CTA BAND ─── */}
      <FadeInView className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32">
        <div className="relative bg-[var(--surface)] rounded-2xl overflow-hidden border border-[var(--border)]">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-15"
            style={{
              backgroundImage:
                "url(https://images.unsplash.com/photo-1487222477894-8943e31ef7b2?w=1200&q=80)",
            }}
          />
          <div className="relative z-10 px-8 md:px-16 py-16 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
            <div className="max-w-lg">
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)] mb-4">
                AI Stylist
              </p>
              <h2 className="text-3xl md:text-5xl font-black uppercase text-[var(--foreground)] leading-tight">
                Your stylist. Always on.
                <br />
                <em>Always personal.</em>
              </h2>
              <p className="mt-4 text-sm text-[var(--foreground-muted)] leading-relaxed">
                Tell GOO your occasion, mood, and budget. Receive a complete outfit
                curated around your profile — every time, instantly.
              </p>
            </div>
            <div className="flex flex-col gap-3 shrink-0">
              <Link
                href="/stylist"
                className="bg-[var(--foreground)] text-[var(--background)] rounded-xl px-8 py-3.5 text-sm font-bold hover:opacity-90 transition-all text-center"
              >
                Start with AI
              </Link>
              <Link
                href="/plans"
                className="text-[10px] tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 text-center"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
      </FadeInView>

      {/* ─── INDIVIDUAL PIECES ─── */}
      {featuredProducts.length > 0 && (
        <section className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32">
          <SectionLabel
            label="Pieces"
            heading="Selected for you"
            subheading="Individual items from premium brands, price-compared across stores."
            action={
              <Link
                href="/browse?view=pieces"
                className="text-[11px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 link-underline"
              >
                View all
              </Link>
            }
          />

          {/* Mobile: horizontal swipe row; Desktop: 4-column grid */}
          <div className="mt-10 hidden md:grid md:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
              <div key={product.id} className="rounded-xl overflow-hidden bg-[var(--background)] hover:shadow-md transition-all duration-200">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
          <div className="mt-6 flex gap-3 overflow-x-auto md:hidden" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {featuredProducts.map((product) => (
              <div key={product.id} className="shrink-0 w-[62vw] max-w-[260px] rounded-xl overflow-hidden bg-[var(--background)]">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── BRAND MARQUEE ─── */}
      <section className="mt-24 md:mt-32 border-t border-b border-[var(--border)] py-6 overflow-hidden">
        <div
          className="flex gap-14 whitespace-nowrap"
          style={{ animation: "marquee 40s linear infinite" }}
        >
          {Array(2)
            .fill([
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
            ])
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

      {/* ─── HOW IT WORKS ─── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32">
        <SectionLabel label="How it works" heading="Style, simplified." />
        <HowItWorksGrid />
      </section>

      {/* ─── PLANS TEASER ─── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-[0.22em] uppercase font-bold text-[var(--foreground-subtle)] mb-2">
              Plans
            </p>
            <h2 className="text-2xl md:text-3xl font-black uppercase text-[var(--foreground)]">
              Free to start. Better as you grow.
            </h2>
          </div>
          <Link
            href="/plans"
            className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 link-underline shrink-0"
          >
            See all plans
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { plan: "Free", price: "$0", note: "3 AI outfits / month" },
            { plan: "Plus", price: "$18", note: "Unlimited AI · Full builder" },
            { plan: "Ultra", price: "$42", note: "Weekly personal edit · Trends" },
          ].map((item, i) => (
            <Link
              key={item.plan}
              href="/plans"
              className={
                i === 1
                  ? "bg-[var(--foreground)] text-[var(--background)] rounded-2xl px-8 py-7 flex items-center justify-between group hover:shadow-md border border-[var(--foreground)] transition-all duration-200"
                  : "bg-[var(--background)] rounded-2xl px-8 py-7 flex items-center justify-between group hover:shadow-md hover:border-[var(--foreground-muted)] border border-[var(--border)] transition-all duration-200"
              }
            >
              <div>
                <p className={`text-[10px] tracking-[0.14em] uppercase font-medium mb-1 ${i === 1 ? "text-white/60" : "text-[var(--foreground-subtle)]"}`}>
                  {item.plan}
                </p>
                <p className={`text-xl font-bold ${i === 1 ? "text-[var(--background)]" : "text-[var(--foreground)]"}`}>
                  {item.price}
                  <span className={`text-xs font-sans ml-1 ${i === 1 ? "text-white/60" : "text-[var(--foreground-muted)]"}`}>
                    / mo
                  </span>
                </p>
                <p className={`text-xs mt-1 ${i === 1 ? "text-white/60" : "text-[var(--foreground-muted)]"}`}>{item.note}</p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className={`transition-colors duration-200 ${i === 1 ? "text-white/60 group-hover:text-white" : "text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)]"}`}
              >
                <path
                  d="M3 8H13M9 4L13 8L9 12"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
