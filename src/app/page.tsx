import Link from "next/link";
import OutfitCard from "@/components/outfit/OutfitCard";
import ProductCard from "@/components/product/ProductCard";
import SectionLabel from "@/components/ui/SectionLabel";
import { getAllOutfits, getAllProducts } from "@/lib/data/db";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

const DEFAULT_HERO =
  "https://images.unsplash.com/photo-1529374255404-311a2a4f1fd9?q=80&w=2069&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";

async function getHeroImageUrl(): Promise<string> {
  if (!isSupabaseConfigured || !supabase) return DEFAULT_HERO;
  try {
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "hero_image_url")
      .maybeSingle();
    return (data as { value: string } | null)?.value ?? DEFAULT_HERO;
  } catch {
    return DEFAULT_HERO;
  }
}

export default async function HomePage() {
  const [allProducts, allOutfits, heroImageUrl] = await Promise.all([
    getAllProducts(),
    getAllOutfits(),
    getHeroImageUrl(),
  ]);
  const featuredOutfits = allOutfits.slice(0, 6);
  const featuredProducts = allProducts.slice(0, 4);

  return (
    <>
      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col justify-end pb-20 md:pb-28 pt-32">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              `url(${heroImageUrl})`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A]/90 via-[#0A0A0A]/30 to-transparent" />

        <div className="relative z-10 max-w-[1440px] mx-auto px-6 md:px-12 w-full">
          <div className="max-w-2xl">
            <p className="text-[10px] tracking-[0.22em] uppercase font-medium text-white/50 mb-6">
              AI Stylist · Personal Wardrobe
            </p>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-light text-white leading-[0.95] tracking-tight mb-8">
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
                className="text-xs tracking-[0.14em] uppercase font-medium text-[#0A0A0A] bg-white px-8 py-4 hover:bg-white/90 transition-colors duration-200"
              >
                Generate Outfit
              </Link>
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-white border border-white/30 px-8 py-4 hover:border-white/70 transition-colors duration-200"
              >
                Browse
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── OUTFITS SECTION ─── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 pt-24 md:pt-32">
        <SectionLabel
          label="Outfits"
          heading="Curated for your style"
          subheading="AI-generated and editorial picks, built around how you live."
          action={
            <Link
              href="/browse"
              className="text-[11px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors duration-200 link-underline"
            >
              View all
            </Link>
          }
        />

        {/* Outfit Grid */}
        <div className={`mt-10 grid grid-cols-1 md:grid-cols-3 gap-px ${featuredOutfits.length > 1 ? "bg-[var(--border)]" : "bg-[var(--background)]"}`}>
          {featuredOutfits[0] && (
            <div className="md:col-span-1 bg-[var(--background)]">
              <div className="p-4">
                <OutfitCard outfit={featuredOutfits[0]} size="large" />
              </div>
            </div>
          )}
          {featuredOutfits.slice(1, 5).length > 0 && (
            <div className="md:col-span-2 bg-[var(--border)]">
              <div className="grid grid-cols-2 gap-px">
                {featuredOutfits.slice(1, 5).map((outfit) => (
                  <div key={outfit.id} className="bg-[var(--background)] p-4">
                    <OutfitCard outfit={outfit} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {featuredOutfits[5] && (
          <div className="mt-px bg-[var(--border)]">
            <div className="bg-[var(--background)] px-4">
              <Link
                href={`/outfit/${featuredOutfits[5].id}`}
                className="group flex items-center justify-between gap-8 py-5"
              >
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 shrink-0 overflow-hidden relative bg-[var(--surface)]">
                    <img
                      src={featuredOutfits[5].imageUrl}
                      alt={featuredOutfits[5].name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-[var(--foreground)]">
                      {featuredOutfits[5].name}
                    </h3>
                    <p className="text-xs text-[var(--foreground-muted)] mt-0.5">
                      {featuredOutfits[5].items.length} pieces · $
                      {featuredOutfits[5].totalPriceMin.toLocaleString()}–$
                      {featuredOutfits[5].totalPriceMax.toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] group-hover:text-[var(--foreground)] transition-colors duration-200 shrink-0">
                  View →
                </span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ─── AI STYLIST CTA BAND ─── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32">
        <div className="relative border border-[var(--border)] overflow-hidden">
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
              <h2 className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)] leading-tight">
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
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200 text-center"
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
      </section>

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

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border)]">
            {featuredProducts.map((product) => (
              <div key={product.id} className="bg-[var(--background)] p-4">
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── BRAND MARQUEE ─── */}
      <section className="mt-24 md:mt-32 border-t border-b border-[var(--border)] py-4 overflow-hidden">
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
              <span
                key={i}
                className="text-[11px] tracking-[0.2em] uppercase font-medium text-[var(--foreground-subtle)]"
              >
                {brand}
              </span>
            ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32">
        <SectionLabel label="How it works" heading="Style, simplified." />

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
          {[
            {
              step: "01",
              title: "Set your profile",
              body: "Body type, color preferences, occasions, budget. Done once, refined over time.",
            },
            {
              step: "02",
              title: "AI builds your outfit",
              body: "Our model selects pieces that fit together — aesthetically and proportionally.",
            },
            {
              step: "03",
              title: "Buy at the best price",
              body: "Each item is price-compared across 50+ retailers. You choose where to buy.",
            },
          ].map((item) => (
            <div key={item.step} className="bg-[var(--background)] p-8 md:p-10 flex flex-col gap-6">
              <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                {item.step}
              </span>
              <div>
                <h3 className="font-display text-xl font-light text-[var(--foreground)] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
                  {item.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PLANS TEASER ─── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 mt-24 md:mt-32 mb-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Plans
            </p>
            <h2 className="font-display text-2xl md:text-3xl font-light text-[var(--foreground)]">
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

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-px bg-[var(--border)]">
          {[
            { plan: "Free", price: "$0", note: "3 AI outfits / month" },
            { plan: "Plus", price: "$18", note: "Unlimited AI · Full builder" },
            { plan: "Ultra", price: "$42", note: "Weekly personal edit · Trends" },
          ].map((item, i) => (
            <Link
              key={item.plan}
              href="/plans"
              className="bg-[var(--background)] px-8 py-6 flex items-center justify-between group hover:bg-[var(--surface)] transition-colors duration-200"
            >
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase font-medium text-[var(--foreground-subtle)] mb-1">
                  {item.plan}
                </p>
                <p className="text-xl font-display font-light text-[var(--foreground)]">
                  {item.price}
                  <span className="text-xs font-sans text-[var(--foreground-muted)] ml-1">
                    / mo
                  </span>
                </p>
                <p className="text-xs text-[var(--foreground-muted)] mt-1">{item.note}</p>
              </div>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-[var(--foreground-subtle)] group-hover:text-[var(--foreground)] transition-colors duration-200"
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
