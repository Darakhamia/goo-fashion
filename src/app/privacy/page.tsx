import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GOO",
  description: "How GOO Fashion collects, uses, and protects your personal data.",
};

const SECTIONS = [
  {
    number: "1",
    title: "Information We Collect",
    content: (
      <ul className="list-none space-y-2">
        {[
          "Personal data (such as email address, name)",
          "Usage data (pages visited, actions on the site)",
          "Device and browser information",
          "Cookies and tracking data",
        ].map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
            <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    number: "2",
    title: "How We Use Your Information",
    content: (
      <ul className="list-none space-y-2">
        {[
          "Provide and improve our services",
          "Personalize user experience",
          "Process subscriptions and payments",
          "Communicate with users",
          "Analyze usage and performance",
        ].map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
            <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    ),
  },
  {
    number: "3",
    title: "Cookies",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We use cookies and similar technologies to understand user behavior, improve website performance, and deliver personalized content and ads.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You can control cookies through your browser settings.
        </p>
      </div>
    ),
  },
  {
    number: "4",
    title: "Third-Party Services",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">We may use third-party services such as:</p>
        <ul className="list-none space-y-2">
          {[
            "Google Analytics",
            "Advertising platforms (e.g. Google Ads)",
            "Affiliate programs (e.g. Amazon Associates)",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
              <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          These services may collect and process data according to their own privacy policies.
        </p>
      </div>
    ),
  },
  {
    number: "5",
    title: "Affiliate Disclosure",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Goo Fashion participates in affiliate programs. This means we may earn commissions from qualifying purchases made through links on our site.
      </p>
    ),
  },
  {
    number: "6",
    title: "Data Storage and Security",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We take reasonable measures to protect your data, but no method of transmission over the internet is 100% secure.
      </p>
    ),
  },
  {
    number: "7",
    title: "Your Rights (GDPR)",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">If you are located in the EU, you have the right to:</p>
        <ul className="list-none space-y-2">
          {[
            "Access your personal data",
            "Request correction or deletion",
            "Withdraw consent",
            "Request data portability",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed">
              <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0" />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          To exercise these rights, contact us at:{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>
        </p>
      </div>
    ),
  },
  {
    number: "8",
    title: "Payments and Subscriptions",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        If you purchase a subscription, payment processing is handled by third-party providers. We do not store full payment details.
      </p>
    ),
  },
  {
    number: "9",
    title: "Changes to This Policy",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may update this policy from time to time. Changes will be posted on this page.
      </p>
    ),
  },
  {
    number: "10",
    title: "Contact",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        If you have any questions, contact us at:{" "}
        <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
          anything@goo-fashion.com
        </a>
      </p>
    ),
  },
];

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)]">
              Last updated: April 2026
            </p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              Goo Fashion ("we", "our", "us") respects your privacy and is committed to protecting your personal data. This policy explains what information we collect and how we use it.
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
            <Link href="/terms" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Terms of Service
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
