import type { Metadata } from "next";
import Link from "next/link";
import CookieSettings from "@/components/consent/CookieSettings";

export const metadata: Metadata = {
  title: "Cookie Policy — GOO",
  description: "Every cookie and browser-storage key Goo Fashion uses, and how to manage them.",
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{children}</p>;
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
      {children}
    </p>
  );
}

function StorageKey({ name, purpose }: { name: string; purpose: string }) {
  return (
    <li className="flex items-start gap-3 text-sm leading-relaxed">
      <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
      <span className="text-[var(--foreground-muted)]">
        <span className="font-mono text-xs text-[var(--foreground)]">{name}</span>
        {" — "}
        {purpose}
      </span>
    </li>
  );
}

const SECTIONS = [
  {
    number: "1",
    title: "Cookies and Similar Technologies",
    content: (
      <div className="space-y-3">
        <P>
          Cookies are small text files a website places on your device. Browsers also offer local storage and
          session storage — key-value stores that stay on your device and, unlike cookies, are not sent to
          servers with every request.
        </P>
        <P>
          Goo Fashion deliberately keeps cookies to a minimum. Most of what we remember about your visit lives
          in local storage on your own device, and our first-party analytics works without any cookies at all.
        </P>
      </div>
    ),
  },
  {
    number: "2",
    title: "Cookies We Set",
    content: (
      <div className="space-y-6">
        <div>
          <SubLabel>Essential — sign-in (Clerk)</SubLabel>
          <P>
            Our authentication provider Clerk sets cookies (names beginning with{" "}
            <span className="font-mono text-xs text-[var(--foreground)]">__session</span>,{" "}
            <span className="font-mono text-xs text-[var(--foreground)]">__client_uat</span> and other{" "}
            <span className="font-mono text-xs text-[var(--foreground)]">__clerk</span>-prefixed names) to keep
            you signed in and protect your account against forged requests. These are strictly necessary and
            cannot be switched off while using an account.
          </P>
        </div>
        <div>
          <SubLabel>Essential — private preview</SubLabel>
          <P>
            During closed-preview periods a{" "}
            <span className="font-mono text-xs text-[var(--foreground)]">goo_preview</span> cookie marks that
            you have access. Outside preview periods this cookie is not set.
          </P>
        </div>
        <div>
          <SubLabel>Analytics — PostHog (only with your consent)</SubLabel>
          <P>
            When product analytics is enabled, a banner asks for your consent before anything loads. Only
            after you press &ldquo;Accept&rdquo; does PostHog store an anonymous visitor identifier in a cookie
            and local storage (names beginning with{" "}
            <span className="font-mono text-xs text-[var(--foreground)]">ph_</span>) to understand how features
            are used. Data is processed on PostHog&rsquo;s EU servers and we do not attach your name or email to
            it. If you decline — or simply ignore the banner — PostHog is never loaded and sets nothing. You can
            change your choice at any time in section 6 below.
          </P>
        </div>
      </div>
    ),
  },
  {
    number: "3",
    title: "Analytics Without Cookies",
    content: (
      <div className="space-y-3">
        <P>
          Our own traffic measurement is cookieless. It uses a random session identifier kept in local storage
          for a rolling 30-minute session, and records pages viewed, referrer, coarse device class and country.
          It does not store your IP address or full browser signature.
        </P>
        <P>
          We also use Vercel Analytics and Vercel Speed Insights, which measure traffic and performance without
          setting any cookies.
        </P>
      </div>
    ),
  },
  {
    number: "4",
    title: "Local Storage We Use",
    content: (
      <div className="space-y-6">
        <div>
          <SubLabel>Preferences</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="goo-theme" purpose="light or dark theme" />
            <StorageKey name="goo-cookie-consent" purpose="your analytics-cookie choice from the consent banner" />
            <StorageKey name="goo-currency" purpose="your display currency" />
            <StorageKey name="goo-exchange-rates" purpose="cached exchange rates (1 hour)" />
            <StorageKey name="ai-tooltip-dismissed" purpose="remembers a dismissed hint" />
          </ul>
        </div>
        <div>
          <SubLabel>Shopping and looks — stays on your device</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="goo-cart" purpose="your shopping cart (never sent to our servers)" />
            <StorageKey name="goo-recently-viewed" purpose="recently viewed products" />
            <StorageKey name="goo-recently-viewed-outfits" purpose="recently viewed outfits" />
            <StorageKey name="goo-liked-outfits / goo-liked-products" purpose="likes while browsing as a guest" />
            <StorageKey name="goo-saved-outfits / goo-synced-looks" purpose="builder looks saved locally and sync markers" />
          </ul>
        </div>
        <div>
          <SubLabel>Analytics session</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="goo_sid / goo_sid_ts" purpose="pseudonymous session id, rolling 30 minutes" />
            <StorageKey name="goo_country / goo_country_ts" purpose="your country code, cached 24 hours" />
          </ul>
        </div>
        <div>
          <SubLabel>Session storage</SubLabel>
          <ul className="list-none space-y-2">
            <StorageKey name="stylist_chat_v1" purpose="keeps your AI Stylist conversation while you move between pages; cleared when the tab closes" />
          </ul>
        </div>
      </div>
    ),
  },
  {
    number: "5",
    title: "Third-Party Cookies After You Leave",
    content: (
      <div className="space-y-3">
        <P>
          Retailer links on Goo Fashion (&ldquo;Where to buy&rdquo;) route through affiliate networks such as
          Awin. After you click, the network and the retailer set their own cookies on their domains to
          attribute the referral. Those cookies are governed by their policies, not ours — we never see them.
        </P>
        <P>
          Payment pages are hosted by monobank, which applies its own cookies on its domain during checkout.
        </P>
      </div>
    ),
  },
  {
    number: "6",
    title: "Managing Cookies and Storage",
    content: (
      <div className="space-y-4">
        <P>
          Your analytics-cookie choice can be reviewed and changed right here — it applies immediately:
        </P>
        <CookieSettings />
        <P>
          You can also delete or block cookies and clear local storage in your browser settings at any time.
          Blocking essential cookies will sign you out and may break account features; clearing local storage
          resets your cart, likes and preferences on that device.
        </P>
        <P>
          For your broader rights over personal data, see &ldquo;Your Rights&rdquo; in our{" "}
          <Link href="/privacy" className="text-[var(--foreground)] link-underline">Privacy Policy</Link>.
        </P>
      </div>
    ),
  },
  {
    number: "7",
    title: "Changes to This Policy",
    content: (
      <P>
        We may update this Cookie Policy from time to time — for example if we add or remove a tool. The
        current version is always published on this page with its &ldquo;last updated&rdquo; date.
      </P>
    ),
  },
  {
    number: "8",
    title: "Contact Information",
    content: (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)]">
          David Arakhamia, Sole Trader
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Mykolaiv, Ukraine
        </p>
        <p className="text-sm text-[var(--foreground-subtle)] leading-relaxed">
          Registered address available on request.
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
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-6 md:px-12">
        <div className="pt-16 md:pt-24 pb-32 max-w-2xl">

          {/* Header */}
          <div className="mb-16 animate-fade-up">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3">
              Legal
            </p>
            <h1 className="text-5xl md:text-6xl font-black uppercase text-[var(--foreground)] mb-4">
              Cookie Policy
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)]">Last updated: August 10, 2026</p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              This Cookie Policy lists every cookie and browser-storage key Goo Fashion actually uses, what
              each one is for, and how you can control them. It supplements our{" "}
              <Link href="/privacy" className="text-[var(--foreground)] link-underline">Privacy Policy</Link>.
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
            <Link href="/refund" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Refund Policy
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
