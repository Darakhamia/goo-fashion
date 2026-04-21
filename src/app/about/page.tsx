import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — GOO",
  description: "GOO is an AI-powered fashion platform built to simplify the way people create outfits and discover clothing.",
};

export default function AboutPage() {
  return (
    <div className="pt-16 min-h-screen">

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="max-w-[1440px] mx-auto px-6 md:px-12 pt-20 md:pt-32 pb-24 md:pb-32">
        <div className="max-w-3xl animate-fade-up">
          <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-6">
            About
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-light text-[var(--foreground)] leading-[1.05] mb-8">
            Style, simplified<br />by intelligence.
          </h1>
          <p className="text-lg md:text-xl text-[var(--foreground-muted)] leading-relaxed max-w-xl">
            GOO is an AI-powered fashion platform built to simplify the way people create outfits and discover clothing.
          </p>
        </div>
      </section>

      {/* ── Origin ─────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                The idea
              </p>
            </div>
            <div className="space-y-5">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed">
                Finding what to wear shouldn&apos;t take hours of browsing through different websites, comparing items, and trying to imagine how everything fits together.
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                We built GOO to solve this. One platform, one AI, everything you need to go from idea to outfit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── What We Do ─────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                What we do
              </p>
            </div>
            <div>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed mb-10">
                GOO combines artificial intelligence, outfit generation, and fashion discovery into one platform. Instead of jumping between multiple websites, you do everything in one place.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border)]">
                {[
                  {
                    number: "01",
                    title: "Generate outfits instantly",
                    body: "Describe a vibe or select pieces — AI composes a full look and renders it.",
                  },
                  {
                    number: "02",
                    title: "Build manually",
                    body: "Use the outfit builder to drag and drop pieces from 50+ brands into a single look.",
                  },
                  {
                    number: "03",
                    title: "AI styling assistant",
                    body: "Chat with your stylist. Get real-time recommendations based on your taste and wardrobe.",
                  },
                  {
                    number: "04",
                    title: "Visualize before you buy",
                    body: "See the full outfit rendered before committing — on a mannequin or as an editorial flat-lay.",
                  },
                ].map((item) => (
                  <div key={item.number} className="bg-[var(--background)] p-7">
                    <p className="font-mono text-[9px] tracking-[0.16em] uppercase text-[var(--foreground-subtle)] mb-4">
                      {item.number}
                    </p>
                    <p className="text-sm font-medium text-[var(--foreground)] mb-2">{item.title}</p>
                    <p className="text-xs text-[var(--foreground-muted)] leading-relaxed">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Why GOO ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                Why GOO
              </p>
            </div>
            <div className="space-y-6">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed">
                Most fashion tools are limited.
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                They help you store clothes, browse items, or get basic suggestions. GOO goes further.
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                Our AI doesn&apos;t just recommend — it helps you think, explore, and create. It combines inspiration, logic, and creativity to build outfits that actually make sense.
              </p>
              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-base text-[var(--foreground)] font-medium leading-relaxed">
                  The goal is not just to suggest clothes,<br />but to help you develop your own style.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who it's for ───────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                Who it&apos;s for
              </p>
            </div>
            <div className="space-y-5">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed">
                Anyone who wants to look better without overcomplicating the process.
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                Men and women. Fashion-forward or fashion-curious. Whether you already care deeply about style or just want quick outfit ideas — the platform adapts to your needs, your taste, and your wardrobe.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Mission ────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="max-w-2xl mx-auto text-center">
            <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)] mb-8">
              Our mission
            </p>
            <p className="font-display text-4xl md:text-5xl font-light text-[var(--foreground)] leading-[1.1] mb-8">
              Style should be simple.
            </p>
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed max-w-lg mx-auto">
              Our mission is to make it easier for everyone to create outfits, experiment with fashion, and feel confident in what they wear. With AI, this becomes possible.
            </p>
          </div>
        </div>
      </section>

      {/* ── Team ───────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)] bg-[var(--surface)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-12 md:gap-20 items-start">
            <div className="md:pt-1">
              <p className="font-mono text-[9px] tracking-[0.2em] uppercase text-[var(--foreground-subtle)]">
                Built by founders
              </p>
            </div>
            <div className="space-y-5">
              <p className="text-2xl md:text-3xl font-light text-[var(--foreground)] leading-relaxed">
                A small team. A big idea.
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                GOO is built by a small founding team focused on creating a modern, AI-first fashion experience. We are constantly improving the platform, adding new features, and exploring how technology can change the way people interact with fashion.
              </p>
              <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
                We move fast, care about design, and ship things that matter.
              </p>
              <div className="pt-6">
                <a
                  href="mailto:anything@goo-fashion.com"
                  className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-all duration-200 inline-block"
                >
                  Get in touch →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="border-t border-[var(--border)]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <p className="font-display text-3xl md:text-4xl font-light text-[var(--foreground)] mb-2">
                Ready to start?
              </p>
              <p className="text-sm text-[var(--foreground-muted)]">
                Build your first outfit in minutes.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/browse"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--background)] bg-[var(--foreground)] px-8 py-4 hover:opacity-80 transition-opacity duration-200"
              >
                Start exploring
              </Link>
              <Link
                href="/plans"
                className="text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] border border-[var(--border)] px-8 py-4 hover:border-[var(--foreground)] transition-colors duration-200"
              >
                See plans
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
