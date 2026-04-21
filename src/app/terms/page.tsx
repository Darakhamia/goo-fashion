import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — GOO",
  description: "The terms governing your use of GOO Fashion.",
};

const SECTIONS = [
  {
    number: "1",
    title: "Use of the Service",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion provides AI-powered fashion tools, including outfit generation and styling recommendations.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You agree to use the service only for lawful purposes.
        </p>
      </div>
    ),
  },
  {
    number: "2",
    title: "Accounts",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You may need to create an account to access certain features.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You are responsible for maintaining the security of your account.
        </p>
      </div>
    ),
  },
  {
    number: "3",
    title: "Subscriptions",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">Some features may require payment.</p>
        <ul className="list-none space-y-2">
          {[
            "Subscriptions may be billed on a recurring basis",
            "Prices may change at any time",
            "No guarantees of specific results",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
              <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    number: "4",
    title: "Intellectual Property",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          All content, design, and technology on Goo Fashion belongs to us.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You may not copy, distribute, or exploit any part without permission.
        </p>
      </div>
    ),
  },
  {
    number: "5",
    title: "AI-Generated Content",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Outfits and recommendations are generated using AI and are provided for informational purposes only.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We do not guarantee accuracy, availability, or suitability.
        </p>
      </div>
    ),
  },
  {
    number: "6",
    title: "Affiliate Links",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may include affiliate links. We may earn commissions from purchases made through these links at no extra cost to you.
      </p>
    ),
  },
  {
    number: "7",
    title: "Limitation of Liability",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">We are not responsible for:</p>
        <ul className="list-none space-y-2">
          {[
            "Any losses from using the service",
            "Decisions made based on AI recommendations",
            "External links or third-party services",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
              <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    number: "8",
    title: "Termination",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may suspend or terminate access at any time without notice if you violate these terms.
      </p>
    ),
  },
  {
    number: "9",
    title: "Changes to Terms",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may update these terms at any time. Continued use of the service constitutes acceptance of the updated terms.
      </p>
    ),
  },
  {
    number: "10",
    title: "Contact",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        For any questions:{" "}
        <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
          anything@goo-fashion.com
        </a>
      </p>
    ),
  },
];

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)]">
              Last updated: April 2026
            </p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              By using Goo Fashion, you agree to the following terms. Please read them carefully before using our platform.
            </p>
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
            <Link href="/" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Back to GOO
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
