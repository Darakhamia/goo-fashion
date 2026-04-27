import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy — GOO",
  description: "How Goo Fashion uses cookies and similar tracking technologies.",
};

function Bullet({ items }: { items: string[] }) {
  return (
    <ul className="list-none space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
          <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

const SECTIONS = [
  {
    number: "1",
    title: "What Are Cookies",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Cookies are small text files placed on your device when you visit a website. They help websites function properly, remember preferences, improve user experience, and collect analytics data.
      </p>
    ),
  },
  {
    number: "2",
    title: "Types of Cookies We Use",
    content: (
      <div className="space-y-6">
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Essential Cookies
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-2">
            These cookies are necessary for the operation of Goo Fashion and cannot be disabled in our systems.
          </p>
          <Bullet
            items={[
              "Authentication and login sessions",
              "Security and fraud prevention",
              "Saving user preferences",
              "Website functionality",
            ]}
          />
        </div>
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Analytics Cookies
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-2">
            These cookies help us understand how users interact with Goo Fashion.
          </p>
          <Bullet
            items={[
              "Page visits",
              "Session duration",
              "Click behavior",
              "Feature usage",
              "Traffic sources",
            ]}
          />
        </div>
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Functional Cookies
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed mb-2">
            These cookies allow Goo Fashion to remember choices you make and provide enhanced features.
          </p>
          <Bullet
            items={[
              "Language settings",
              "Theme preferences",
              "Saved filters and preferences",
            ]}
          />
        </div>
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Affiliate / Tracking Cookies
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            These cookies may be used to track referrals to third-party retailers or affiliate partners. They help attribute purchases or clicks originating from Goo Fashion.
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Marketing Cookies
          </p>
          <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
            These cookies may be used to personalize ads, retarget visitors, and measure campaign performance.
          </p>
        </div>
      </div>
    ),
  },
  {
    number: "3",
    title: "Third-Party Cookies",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Third-party service providers may place cookies through Goo Fashion, including but not limited to:
        </p>
        <Bullet
          items={[
            "Analytics providers",
            "Payment providers",
            "Affiliate networks",
            "Advertising partners",
            "Embedded third-party tools and services",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We do not control third-party cookies directly.
        </p>
      </div>
    ),
  },
  {
    number: "4",
    title: "Managing Cookies",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Most browsers allow you to control or disable cookies through browser settings.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Please note that disabling certain cookies may affect the functionality of Goo Fashion.
        </p>
      </div>
    ),
  },
  {
    number: "5",
    title: "Consent",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Where required by law, Goo Fashion will request your consent before placing non-essential cookies.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You may withdraw or modify cookie consent at any time through available cookie settings tools, where implemented.
        </p>
      </div>
    ),
  },
  {
    number: "6",
    title: "Changes to This Policy",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may update this Cookie Policy from time to time. Updated versions become effective upon publication on the website.
      </p>
    ),
  },
  {
    number: "7",
    title: "Contact Information",
    content: (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          David Arakhamia, Sole Trader
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Вадима Благовисного 62<br />
          54001, Mykolaiv<br />
          Ukraine
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed pt-1">
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>
        </p>
      </div>
    ),
  },
];

export default function CookiePage() {
  return (
    <div className="pt-16 min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-16 md:pt-24 pb-32 max-w-2xl">

          {/* Header */}
          <div className="mb-16 animate-fade-up">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Legal
            </p>
            <h1 className="font-display text-5xl md:text-6xl font-light text-[var(--foreground)] mb-4">
              Cookie Policy
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)]">Last updated: April 25, 2026</p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              This Cookie Policy explains how Goo Fashion uses cookies and similar tracking technologies when you visit or use our website and related services. By continuing to use Goo Fashion, you consent to the use of cookies as described in this Policy, except where consent is required separately by applicable law.
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-[var(--border)]">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">Operator</p>
                <p className="text-sm text-[var(--foreground-muted)]">David Arakhamia, Sole Trader</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">Website</p>
                <p className="text-sm text-[var(--foreground-muted)]">goo-fashion.com</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1">Contact</p>
                <a href="mailto:anything@goo-fashion.com" className="text-sm text-[var(--foreground-muted)] link-underline hover:text-[var(--foreground)] transition-colors">
                  anything@goo-fashion.com
                </a>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-12">
            {SECTIONS.map((section) => (
              <div key={section.number} className="grid grid-cols-[40px_1fr] gap-6">
                <div className="pt-0.5">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--foreground-subtle)]">
                    {section.number.padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-medium text-[var(--foreground)] mb-4">
                    {section.title}
                  </h2>
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          {/* Footer nav */}
          <div className="mt-20 pt-10 border-t border-[var(--border)] flex flex-wrap gap-6">
            <Link href="/privacy" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Terms &amp; Conditions
            </Link>
            <Link href="/" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Back to GOO
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
