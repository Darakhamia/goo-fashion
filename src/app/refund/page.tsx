import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Subscription & Refund Policy — GOO",
  description: "How Goo Fashion subscriptions are billed and renewed, how to cancel, and when refunds apply.",
};

function Bullet({ items }: { items: string[] }) {
  return (
    <ul className="list-none space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          <span className="mt-2 w-1 h-1 rounded-full bg-[var(--foreground-subtle)] shrink-0 max-md:mt-[11px]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">{children}</p>;
}

const SECTIONS = [
  {
    number: "1",
    title: "What This Policy Covers",
    content: (
      <div className="space-y-3">
        <P>
          This policy applies to paid Goo Fashion subscriptions — digital services such as AI styling,
          outfit generation and other premium features. It supplements our{" "}
          <Link href="/terms" className="text-[var(--foreground)] link-underline">Terms &amp; Conditions</Link>.
        </P>
        <P>
          Goo Fashion does not sell physical goods. Purchases made from third-party retailers you reach
          through links on our site are contracts with those retailers — their own payment, delivery, return
          and refund policies apply, and this policy does not cover them.
        </P>
      </div>
    ),
  },
  {
    number: "2",
    title: "Pricing and Payment",
    content: (
      <div className="space-y-3">
        <P>
          Subscription prices are shown on the{" "}
          <Link href="/plans" className="text-[var(--foreground)] link-underline">Plans</Link> page and at
          checkout. Billing is in Ukrainian hryvnia (UAH); any other currency shown is an approximate
          reference for convenience. Prices include applicable taxes.
        </P>
        <P>
          Payments are processed by monobank (Plata by mono). You enter your card details on monobank&rsquo;s
          secure hosted payment page — your full card number never reaches Goo Fashion. For renewals,
          monobank issues us a reusable card token; we store only that token and a masked card number.
        </P>
      </div>
    ),
  },
  {
    number: "3",
    title: "Auto-Renewal",
    content: (
      <div className="space-y-3">
        <P>
          Subscriptions are billed monthly and renew automatically. At the end of each billing period your
          saved card is charged the then-current price of your plan, and the subscription is extended by one
          month, until you cancel.
        </P>
        <P>
          Your subscription becomes active only after the payment provider confirms your payment.
        </P>
      </div>
    ),
  },
  {
    number: "4",
    title: "How to Cancel",
    content: (
      <div className="space-y-3">
        <P>
          You can cancel auto-renewal at any time in{" "}
          <Link href="/profile" className="text-[var(--foreground)] link-underline">Profile</Link> → Plan →
          Cancel subscription, or by emailing us. Cancellation takes effect at the end of the current paid
          period:
        </P>
        <Bullet
          items={[
            "you keep full access to paid features until the end of the period you have paid for",
            "no further charges are made after cancellation",
            "cancelling does not by itself trigger a refund for the current period (see Section 6)",
          ]}
        />
      </div>
    ),
  },
  {
    number: "5",
    title: "Failed Payments",
    content: (
      <P>
        If a renewal charge fails, we retry on subsequent days and the subscription is marked past due. After
        three consecutive failed attempts the subscription is cancelled and the account returns to the Free
        plan. You can resubscribe at any time.
      </P>
    ),
  },
  {
    number: "6",
    title: "Refunds",
    content: (
      <div className="space-y-3">
        <P>
          Paid features are digital services that begin immediately after payment. By subscribing you request
          immediate performance; where you are protected by a statutory withdrawal right for digital services
          (for example in the EU/EEA), you acknowledge that the right lapses once the service has been fully
          performed during the withdrawal period.
        </P>
        <P>
          Subscription fees for a started billing period are therefore generally non-refundable, including for
          partly used months. We will, however, refund you where:
        </P>
        <Bullet
          items={[
            "you were charged in error, including duplicate charges",
            "you were charged after cancelling in accordance with Section 4",
            "the paid service was unavailable for a significant period due to a fault on our side",
            "a refund is required by applicable consumer-protection law, including the Law of Ukraine On Protection of Consumer Rights",
          ]}
        />
        <P>Nothing in this policy limits your mandatory statutory rights.</P>
      </div>
    ),
  },
  {
    number: "7",
    title: "How to Request a Refund",
    content: (
      <div className="space-y-3">
        <P>
          Email{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>{" "}
          from the address linked to your account within 14 days of the charge, describing the issue. Please
          include the charge date and amount.
        </P>
        <P>
          We review requests within 10 business days. Approved refunds are returned to the original payment
          method via monobank; how quickly the money appears depends on your bank (typically 3–10 business
          days).
        </P>
      </div>
    ),
  },
  {
    number: "8",
    title: "Price Changes",
    content: (
      <P>
        We may change subscription prices. Changes never apply retroactively to a period you have already
        paid for: we will notify you on the website or by email before a new price takes effect at your next
        renewal, and you can cancel before then if you do not agree.
      </P>
    ),
  },
  {
    number: "9",
    title: "Contact Information",
    content: (
      <div className="space-y-1">
        <p className="text-sm font-medium text-[var(--foreground)] max-md:text-base">
          David Arakhamia, Sole Trader
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          Mykolaiv, Ukraine
        </p>
        <p className="text-sm text-[var(--foreground-subtle)] leading-relaxed max-md:text-[15px] max-md:text-[var(--foreground-muted)]">
          Registered address available on request.
        </p>
        <p className="text-sm text-[var(--foreground-muted)] leading-relaxed pt-1 max-md:text-base max-md:leading-[1.6] max-md:text-[var(--foreground)]">
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline max-md:py-3">
            anything@goo-fashion.com
          </a>
        </p>
      </div>
    ),
  },
];

export default function RefundPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-[1440px] mx-auto px-5 md:px-12">
        <div className="pt-6 md:pt-24 pb-14 md:pb-32 max-w-2xl">

          {/* Header */}
          <div className="mb-8 md:mb-16 animate-fade-up">
            <p className="text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] mb-3 max-md:hidden">
              Legal
            </p>
            <h1 className="text-5xl md:text-6xl font-black uppercase text-[var(--foreground)] mb-4 max-md:text-[28px] max-md:leading-[1.15] max-md:font-semibold max-md:normal-case max-md:mb-1.5">
              Subscription &amp; Refund Policy
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)] max-md:text-[13px] max-md:text-[var(--foreground-muted)]">Last updated: August 10, 2026</p>
          </div>

          {/* Intro */}
          <div className="mb-8 pb-8 md:mb-16 md:pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed max-md:leading-[1.6] max-md:text-[var(--foreground)]">
              This policy explains how Goo Fashion subscriptions are billed and renewed, how to cancel, and
              when you are entitled to a refund. By purchasing a subscription you agree to this policy.
            </p>
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-[var(--border)]">
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">Operator</p>
                <p className="text-sm text-[var(--foreground-muted)] max-md:text-base max-md:text-[var(--foreground)]">David Arakhamia, Sole Trader</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">Website</p>
                <p className="text-sm text-[var(--foreground-muted)] max-md:text-base max-md:text-[var(--foreground)]">goo-fashion.com</p>
              </div>
              <div>
                <p className="text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] mb-1 max-md:text-[13px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">Contact</p>
                <a href="mailto:anything@goo-fashion.com" className="text-sm text-[var(--foreground-muted)] link-underline hover:text-[var(--foreground)] transition-colors max-md:text-base">
                  anything@goo-fashion.com
                </a>
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-8 md:space-y-12">
            {SECTIONS.map((section) => (
              <div key={section.number} className="grid grid-cols-[40px_1fr] gap-6 max-md:block">
                <div className="pt-0.5 max-md:hidden">
                  <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--foreground-subtle)]">
                    {section.number.padStart(2, "0")}
                  </span>
                </div>
                <div>
                  <h2 className="text-base font-medium text-[var(--foreground)] mb-4 max-md:text-[18px] max-md:font-semibold max-md:leading-snug max-md:mb-2.5">
                    <span className="md:hidden text-[var(--foreground-muted)]">{section.number} · </span>
                    {section.title}
                  </h2>
                  {section.content}
                </div>
              </div>
            ))}
          </div>

          {/* Footer nav */}
          <div className="mt-20 pt-10 border-t border-[var(--border)] flex flex-wrap gap-6 max-md:mt-12 max-md:pt-4 max-md:gap-x-5 max-md:gap-y-0">
            <Link href="/terms" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline max-md:text-[15px] max-md:normal-case max-md:tracking-normal max-md:py-3">
              Terms &amp; Conditions
            </Link>
            <Link href="/privacy" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline max-md:text-[15px] max-md:normal-case max-md:tracking-normal max-md:py-3">
              Privacy Policy
            </Link>
            <Link href="/cookie" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline max-md:text-[15px] max-md:normal-case max-md:tracking-normal max-md:py-3">
              Cookie Policy
            </Link>
            <Link href="/" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline max-md:text-[15px] max-md:normal-case max-md:tracking-normal max-md:py-3">
              Back to GOO
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
