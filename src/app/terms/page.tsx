import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms & Conditions — GOO",
  description: "The terms and conditions governing your access to and use of Goo Fashion.",
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
    title: "About Goo Fashion",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion is a fashion-tech platform that helps users discover fashion items, build outfits, generate style ideas, and access links to third-party fashion retailers.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion does not sell the displayed fashion products directly unless expressly stated otherwise. Products shown on the website are provided by third-party retailers, brands, marketplaces, or affiliate partners.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          When you click a product link and leave Goo Fashion, any purchase is made directly with the third-party retailer, not with Goo Fashion.
        </p>
      </div>
    ),
  },
  {
    number: "2",
    title: "Eligibility",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You must be at least 16 years old to use Goo Fashion.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          If you are under the age of legal majority in your country, you may use the service only with permission from a parent or legal guardian.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          The service is not intended for children under 13 years old.
        </p>
      </div>
    ),
  },
  {
    number: "3",
    title: "Account Registration",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Some features may require an account. You agree to provide accurate and up-to-date information when creating an account. You are responsible for keeping your login credentials secure and for all activity under your account.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          If you believe your account has been accessed without permission, contact us immediately at{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>
          .
        </p>
      </div>
    ),
  },
  {
    number: "4",
    title: "Third-Party Products and Retailers",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion may display product images, names, prices, descriptions, brand names, availability, and links to third-party websites. We do not guarantee that:
        </p>
        <Bullet
          items={[
            "product prices are always correct",
            "items remain available",
            "product descriptions are complete or accurate",
            "images fully match the final product",
            "third-party retailers will complete your order correctly",
            "delivery, returns, refunds, or support from third-party retailers will meet your expectations",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          All purchases made through third-party websites are governed by the third party's own terms and policies. Goo Fashion is not responsible for third-party websites, products, services, payments, delivery, returns, refunds, or disputes.
        </p>
      </div>
    ),
  },
  {
    number: "5",
    title: "Affiliate Links and Commercial Relationships",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Some links on Goo Fashion may be affiliate links. This means Goo Fashion may receive a commission or other compensation if you click a link or make a purchase through it.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Affiliate relationships may influence how products, brands, or retailers are displayed, ranked, or recommended.
        </p>
      </div>
    ),
  },
  {
    number: "6",
    title: "Intellectual Property",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          All original content, design, branding, layout, interface, software, text, graphics, logos, and materials created by Goo Fashion are owned by Goo Fashion or its licensors.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You may not copy, reproduce, distribute, modify, reverse engineer, scrape, or exploit any part of the platform without prior written permission.
        </p>
      </div>
    ),
  },
  {
    number: "7",
    title: "Third-Party Images, Brands, and Content",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion may display third-party product images, logos, trademarks, names, descriptions, and related materials. All such materials remain the property of their respective owners.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Their display on Goo Fashion does not imply endorsement, partnership, ownership, or affiliation unless explicitly stated.
        </p>
      </div>
    ),
  },
  {
    number: "8",
    title: "User Content",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Users may upload, save, submit, or publish content including outfit combinations, wardrobe items, images, prompts, and comments. You retain ownership of your User Content.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          By uploading User Content, you grant Goo Fashion a limited worldwide license to use, process, store, display, and modify such content solely for operating and improving the service.
        </p>
      </div>
    ),
  },
  {
    number: "9",
    title: "User Content Rules",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You may not upload content that:
        </p>
        <Bullet
          items={[
            "infringes third-party rights",
            "contains unlawful, harmful, explicit, hateful, or misleading material",
            "contains malware or malicious code",
            "falsely suggests affiliation with a brand or retailer",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion may remove content at its discretion.
        </p>
      </div>
    ),
  },
  {
    number: "10",
    title: "AI Features and Generated Content",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion may provide AI-powered outfit generation, styling recommendations, and visual outputs. AI-generated content is provided for informational and inspirational purposes only.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We do not guarantee:
        </p>
        <Bullet
          items={[
            "accuracy of AI outputs",
            "availability of suggested items",
            "suitability of recommendations",
            "originality of generated content",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Users rely on AI-generated outputs at their own risk.
        </p>
      </div>
    ),
  },
  {
    number: "11",
    title: "Image Uploads and AI Processing",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        If you upload images, you confirm you have rights and permissions to do so. Uploaded images may be processed by Goo Fashion or third-party AI/technology providers solely for service functionality.
      </p>
    ),
  },
  {
    number: "12",
    title: "Prohibited Use",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You agree not to:
        </p>
        <Bullet
          items={[
            "use Goo Fashion unlawfully",
            "scrape or harvest data or content",
            "use bots or automation without permission",
            "interfere with platform security",
            "upload harmful or infringing content",
            "misuse affiliate systems",
            "build competing services using Goo Fashion's data, content, or interface",
          ]}
        />
      </div>
    ),
  },
  {
    number: "13",
    title: "Copyright and IP Complaints",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          If you believe content on Goo Fashion infringes your rights, contact{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>{" "}
          and include:
        </p>
        <Bullet
          items={[
            "your contact information",
            "identification of infringing material",
            "proof of ownership or rights",
            "explanation of unauthorised use",
          ]}
        />
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          We may remove disputed content while reviewing.
        </p>
      </div>
    ),
  },
  {
    number: "14",
    title: "Subscriptions and Paid Features",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Goo Fashion may offer premium subscriptions or paid digital services. Subscription terms, billing intervals, renewal rules, and pricing will be disclosed before purchase.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Subscriptions renew automatically unless cancelled.
        </p>
      </div>
    ),
  },
  {
    number: "15",
    title: "Refunds",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Digital services, AI credits, subscriptions, and premium features may be non-refundable once activated or used unless required by law.
      </p>
    ),
  },
  {
    number: "16",
    title: "Privacy",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Use of Goo Fashion is subject to our{" "}
        <Link href="/privacy" className="text-[var(--foreground)] link-underline">
          Privacy Policy
        </Link>
        .
      </p>
    ),
  },
  {
    number: "17",
    title: "Cookies and Tracking",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Goo Fashion may use cookies, analytics, and affiliate tracking technologies. More details are provided in our Cookie Policy.
      </p>
    ),
  },
  {
    number: "18",
    title: "Availability of Service",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We do not guarantee uninterrupted, secure, or error-free service. We may modify, suspend, or discontinue the service at any time.
      </p>
    ),
  },
  {
    number: "19",
    title: "Disclaimer",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        Goo Fashion is provided "as is" and "as available." We disclaim all warranties to the maximum extent permitted by law. Use of the platform is at your own risk.
      </p>
    ),
  },
  {
    number: "20",
    title: "Limitation of Liability",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          To the maximum extent permitted by law, Goo Fashion shall not be liable for indirect, incidental, consequential, or punitive damages.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          Our total liability shall not exceed the greater of: the amount paid by you to Goo Fashion in the previous 12 months, or <span className="text-[var(--foreground)] font-medium">100 USD</span>.
        </p>
      </div>
    ),
  },
  {
    number: "21",
    title: "Indemnity",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
          You agree to indemnify Goo Fashion against claims arising from:
        </p>
        <Bullet
          items={[
            "your misuse of the platform",
            "your uploaded content",
            "your legal violations",
            "infringement of third-party rights",
          ]}
        />
      </div>
    ),
  },
  {
    number: "22",
    title: "Termination",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may suspend or terminate access if you violate these Terms or create legal or operational risk.
      </p>
    ),
  },
  {
    number: "23",
    title: "Changes to Terms",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        We may update these Terms at any time. Continued use of Goo Fashion after updates constitutes acceptance.
      </p>
    ),
  },
  {
    number: "24",
    title: "Governing Law",
    content: (
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">
        These Terms are governed by the laws of <span className="text-[var(--foreground)]">Ukraine</span>. Mandatory consumer rights under applicable law remain unaffected.
      </p>
    ),
  },
  {
    number: "25",
    title: "Contact Information",
    content: (
      <div className="space-y-1">
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed font-medium text-[var(--foreground)]">
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
              Terms &amp; Conditions
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)]">Last updated: April 25, 2026</p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              These Terms &amp; Conditions govern your access to and use of Goo Fashion, including our website, digital tools, AI styling features, outfit builder, saved looks, product discovery features, affiliate links, and related services. By using Goo Fashion, you agree to these Terms. If you do not agree, please do not use the website or services.
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
            <Link href="/" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Back to GOO
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
