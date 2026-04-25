import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GOO",
  description: "How Goo Fashion collects, uses, stores, and protects your personal data.",
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
    title: "Data We Collect",
    content: (
      <div className="space-y-5">
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Information You Provide
          </p>
          <Bullet
            items={[
              "Name",
              "Email address",
              "Login credentials",
              "Billing information",
              "Support messages",
              "Uploaded images and content",
              "Profile and preference data",
            ]}
          />
        </div>
        <div>
          <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-2">
            Automatically Collected Information
          </p>
          <Bullet
            items={[
              "IP address",
              "Device and browser information",
              "Operating system",
              "Referral source",
              "Usage and activity logs",
              "Pages visited and session duration",
              "Cookies and tracking identifiers",
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    number: "2",
    title: "How We Use Your Data",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We use personal data to:
        </p>
        <Bullet
          items={[
            "Provide and operate Goo Fashion",
            "Create and manage user accounts",
            "Deliver AI styling and outfit generation features",
            "Process subscriptions and payments",
            "Improve platform performance and user experience",
            "Personalize recommendations and content",
            "Provide support",
            "Detect abuse, fraud, or misuse",
            "Comply with legal obligations",
          ]}
        />
      </div>
    ),
  },
  {
    number: "3",
    title: "Legal Bases for Processing (GDPR)",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Where GDPR applies, we process data based on:
        </p>
        <Bullet
          items={[
            "Performance of a contract",
            "Legitimate interests",
            "Compliance with legal obligations",
            "Your consent where required",
          ]}
        />
      </div>
    ),
  },
  {
    number: "4",
    title: "Sharing of Data",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We may share personal data with:
        </p>
        <Bullet
          items={[
            "Hosting and infrastructure providers",
            "Payment processors",
            "Analytics providers",
            "AI and technology providers used to power platform functionality",
            "Customer support tools",
            "Legal and regulatory authorities when required",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We do not sell personal data to third parties.
        </p>
      </div>
    ),
  },
  {
    number: "5",
    title: "International Transfers",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Your data may be processed or stored outside your country of residence. Where required, we implement safeguards for international data transfers in accordance with applicable law.
      </p>
    ),
  },
  {
    number: "6",
    title: "Data Retention",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We retain personal data only for as long as necessary to:
        </p>
        <Bullet
          items={[
            "Provide the service",
            "Fulfill contractual obligations",
            "Comply with legal obligations",
            "Resolve disputes",
            "Enforce agreements",
          ]}
        />
      </div>
    ),
  },
  {
    number: "7",
    title: "Your Rights",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Depending on applicable law, you may have rights to:
        </p>
        <Bullet
          items={[
            "Access your personal data",
            "Correct inaccurate data",
            "Delete your data",
            "Restrict processing",
            "Object to processing",
            "Data portability",
            "Withdraw consent",
            "Lodge a complaint with a supervisory authority",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          To exercise rights, contact:{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>
        </p>
      </div>
    ),
  },
  {
    number: "8",
    title: "Cookies and Tracking",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We use cookies and similar technologies for:
        </p>
        <Bullet
          items={[
            "Essential website functionality",
            "Analytics and performance",
            "Personalization",
            "Affiliate tracking",
            "Marketing and advertising",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          More details are available in our Cookie Policy.
        </p>
      </div>
    ),
  },
  {
    number: "9",
    title: "Security",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We implement reasonable technical and organizational measures to protect personal data. However, no method of transmission or storage is completely secure.
      </p>
    ),
  },
  {
    number: "10",
    title: "Children's Privacy",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Goo Fashion is not intended for children under 13. We do not knowingly collect personal data from children under 13.
      </p>
    ),
  },
  {
    number: "11",
    title: "Third-Party Links",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Our website may contain links to third-party websites. We are not responsible for the privacy practices of third-party websites.
      </p>
    ),
  },
  {
    number: "12",
    title: "Changes to This Policy",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may update this Privacy Policy from time to time. Updated versions become effective when published.
      </p>
    ),
  },
  {
    number: "13",
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
            <p className="text-sm text-[var(--foreground-subtle)]">Last updated: April 25, 2026</p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              This Privacy Policy explains how Goo Fashion collects, uses, stores, and protects personal data when you use our website, applications, and related services. By using Goo Fashion, you acknowledge the practices described in this Privacy Policy.
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
