import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — GOO",
  description: "How Goo Fashion collects, uses, shares, and protects your personal data.",
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

function Processor({ name, purpose, data }: { name: string; purpose: string; data: string }) {
  return (
    <div className="border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium text-[var(--foreground)] mb-1">{name}</p>
      <p className="text-sm text-[var(--foreground-muted)] leading-relaxed">{purpose}</p>
      <p className="text-xs text-[var(--foreground-subtle)] leading-relaxed mt-1">Data involved: {data}</p>
    </div>
  );
}

const SECTIONS = [
  {
    number: "1",
    title: "Who We Are",
    content: (
      <div className="space-y-3">
        <P>
          Goo Fashion (&ldquo;GOO&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, &ldquo;us&rdquo;) is a fashion-discovery and AI-styling
          platform available at goo-fashion.com. The service is operated by:
        </P>
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--foreground)]">David Arakhamia, Sole Trader</p>
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
        <P>
          For the purposes of the EU General Data Protection Regulation (GDPR) and the Law of Ukraine
          &ldquo;On Personal Data Protection&rdquo;, the operator above is the data controller for personal data
          processed through the website.
        </P>
      </div>
    ),
  },
  {
    number: "2",
    title: "Information We Collect",
    content: (
      <div className="space-y-6">
        <div>
          <SubLabel>Account data</SubLabel>
          <P>
            When you create an account, our authentication provider Clerk collects your email address, name,
            optional profile photo and — if you sign in with a social account — your public profile identifiers
            from that provider. Your password is handled entirely by Clerk and never reaches our servers.
          </P>
        </div>
        <div>
          <SubLabel>Style profile (optional)</SubLabel>
          <P>
            To personalise recommendations you can voluntarily provide: body type, clothing and shoe sizes,
            budget range, favourite colours and styles, a nickname, pronouns, style goals, lifestyle notes,
            and &ldquo;hard limits&rdquo; — things GOO should never suggest. You can edit or clear these in your
            profile at any time.
          </P>
        </div>
        <div>
          <SubLabel>Content you create</SubLabel>
          <P>
            Liked products and outfits, saved looks, looks you submit for publication, and — for signed-in
            users — your AI Stylist chat history, so conversations can continue across devices.
          </P>
        </div>
        <div>
          <SubLabel>Try-on photos</SubLabel>
          <P>
            If you use virtual try-on, the photo you upload is processed to generate the styled image and is
            not saved on our servers. The finished generated image is stored and linked to your account
            (see Section 4).
          </P>
        </div>
        <div>
          <SubLabel>Payment and subscription data</SubLabel>
          <P>
            Your plan, price and currency, subscription status and renewal dates, payment-invoice identifiers,
            a reusable card token issued by our payment provider, and a masked card number (first six and last
            four digits). Your full card number is entered on monobank&rsquo;s secure payment page and never
            touches our servers.
          </P>
        </div>
        <div>
          <SubLabel>Usage data</SubLabel>
          <P>
            A pseudonymous session identifier, pages viewed, referring page, UTM tags, coarse device type,
            browser and operating-system class, your country code, and page-performance metrics. We do not
            store your IP address or full browser user-agent string in our analytics database. When you are
            signed in, usage records may be linked to your account identifier.
          </P>
        </div>
        <div>
          <SubLabel>Communications</SubLabel>
          <P>
            Your email address if you join the waitlist, the content of bug reports (description, page
            address, an optional screenshot), and any messages you send us by email.
          </P>
        </div>
        <div>
          <SubLabel>Data that stays on your device</SubLabel>
          <P>
            Your shopping cart, recently viewed items, guest likes, theme and currency preferences are stored
            only in your browser&rsquo;s local storage and are not transmitted to our servers. See the{" "}
            <Link href="/cookie" className="text-[var(--foreground)] link-underline">Cookie Policy</Link>{" "}
            for the full inventory.
          </P>
        </div>
      </div>
    ),
  },
  {
    number: "3",
    title: "How We Use Your Information",
    content: (
      <div className="space-y-3">
        <P>We use personal data for the following purposes, on the following legal bases:</P>
        <Bullet
          items={[
            "Providing the service — accounts, saved content, styling tools (performance of a contract)",
            "Processing payments and managing subscriptions and renewals (performance of a contract; legal obligations, e.g. accounting)",
            "Personalised AI styling based on the profile details you choose to share (performance of a contract)",
            "Understanding how the site is used and improving it (legitimate interest)",
            "Service messages about your account or subscription, and occasional product announcements (legitimate interest; you can object at any time)",
            "Security, rate limiting and abuse prevention (legitimate interest)",
            "Complying with legal obligations (legal obligation)",
          ]}
        />
      </div>
    ),
  },
  {
    number: "4",
    title: "AI Features and Your Data",
    content: (
      <div className="space-y-3">
        <P>
          GOO&rsquo;s styling features are powered by third-party AI infrastructure. What is shared depends on
          the feature:
        </P>
        <Bullet
          items={[
            "AI Stylist chat — your messages, recent conversation history, your style-personalisation details and relevant catalogue excerpts are sent to Replicate, which runs the language model that generates the reply",
            "Catalogue search — your search or chat query may be converted into an embedding via OpenAI to match it against our catalogue",
            "Virtual try-on — your uploaded photo and the selected product images are sent to an image model hosted on Replicate; your photo is processed transiently and is not stored by us; the generated image is stored in our storage and linked to your account",
            "Bug reports — your report text and optional screenshot are analysed by Anthropic (Claude) and the structured result is filed in our internal issue tracker",
          ]}
        />
        <P>
          These providers act as our processors under their API terms, which state that content submitted via
          API is not used to train their models. AI outputs are recommendations and visualisations only — we
          make no automated decisions about you that produce legal or similarly significant effects.
        </P>
      </div>
    ),
  },
  {
    number: "5",
    title: "Cookies and Similar Technologies",
    content: (
      <P>
        We keep cookies to a minimum: essential sign-in cookies, and an optional analytics cookie set only
        after you accept it in our consent banner. Our{" "}
        <Link href="/cookie" className="text-[var(--foreground)] link-underline">Cookie Policy</Link> lists
        every cookie and browser-storage key we use, and lets you change your analytics choice at any time.
      </P>
    ),
  },
  {
    number: "6",
    title: "Who We Share Data With",
    content: (
      <div className="space-y-4">
        <P>
          We do not sell personal data. We share it only with the service providers below (acting on our
          instructions), with affiliate networks as described in Section 7, or where required by law.
        </P>
        <div className="space-y-4">
          <Processor name="Clerk (USA)" purpose="Authentication and account management." data="account data, style profile" />
          <Processor name="Supabase" purpose="Database and file storage." data="likes, looks, chat history, subscriptions, analytics events" />
          <Processor name="Vercel (USA)" purpose="Website hosting and cookieless web analytics." data="request data; IP addresses appear transiently in server logs" />
          <Processor name="monobank / Plata by mono (Ukraine)" purpose="Payment processing and card tokenisation on their hosted payment page." data="payment details, subscription reference including your account identifier" />
          <Processor name="Replicate (USA)" purpose="Running the AI models behind the stylist chat and virtual try-on." data="chat messages, style personalisation, try-on photos, product images" />
          <Processor name="OpenAI (USA)" purpose="Search embeddings for catalogue matching." data="search and chat queries; product texts" />
          <Processor name="Anthropic (USA)" purpose="Structuring bug reports." data="report text, page address, optional screenshot" />
          <Processor name="Resend (USA)" purpose="Email delivery." data="email address, message content" />
          <Processor name="Upstash" purpose="Rate limiting to prevent abuse." data="IP addresses and account identifiers, kept from about a minute up to one day" />
          <Processor name="PostHog (EU hosting)" purpose="Product analytics — loaded only after you accept analytics cookies in the consent banner." data="usage events and visited page addresses" />
          <Processor name="Cloudflare / ipapi.co" purpose="Resolving your country for regional statistics." data="IP address, used transiently for the lookup and never stored by us" />
          <Processor name="Google (favicon service)" purpose="Loading retailer logos on product pages." data="your browser requests the logo image directly from Google" />
        </div>
      </div>
    ),
  },
  {
    number: "7",
    title: "Affiliate Links Disclosure",
    content: (
      <div className="space-y-3">
        <P>
          Goo Fashion earns commissions from qualifying purchases made through retailer links on our site
          (&ldquo;Where to buy&rdquo;). These links route through affiliate networks such as Awin, which set
          their own tracking cookies on their and the retailer&rsquo;s domains after you click.
        </P>
        <P>
          We receive aggregated commission reports from affiliate networks; they do not tell us who you are.
          Purchases from third-party retailers are governed by those retailers&rsquo; own privacy policies.
        </P>
      </div>
    ),
  },
  {
    number: "8",
    title: "International Transfers",
    content: (
      <P>
        We operate from Ukraine and use service providers in the European Union and the United States. Where
        personal data of EEA/UK residents is transferred outside those regions, we rely on the providers&rsquo;
        appropriate safeguards, such as Standard Contractual Clauses or certification under the EU–U.S. Data
        Privacy Framework.
      </P>
    ),
  },
  {
    number: "9",
    title: "Data Retention",
    content: (
      <Bullet
        items={[
          "Account and profile data — for as long as your account exists",
          "Billing and subscription records — for as long as accounting and tax law requires",
          "AI Stylist chat history — until you delete it or ask us to delete your account data",
          "Analytics records — currently retained without a fixed expiry; deleted on request where they can be linked to you",
          "Data in your browser storage — entirely under your control; clear it in your browser at any time",
        ]}
      />
    ),
  },
  {
    number: "10",
    title: "Public Content",
    content: (
      <div className="space-y-3">
        <P>
          Some content you create is public by design: a look you share via a link can be viewed by anyone who
          has that link, and looks you submit for publication become publicly visible if approved. Generated
          try-on images are stored at link-accessible addresses.
        </P>
        <P>
          Please do not include anything in shared content that you would not want visible to others. To have
          a shared look or generated image removed, email us and we will take it down.
        </P>
      </div>
    ),
  },
  {
    number: "11",
    title: "Security",
    content: (
      <P>
        We protect data with encryption in transit (TLS), tokenised payments (we never hold full card
        numbers), cryptographically signed payment notifications, and access controls on administrative
        systems. No method of transmission or storage is 100% secure, but we work to protect your data with
        measures appropriate to the risk.
      </P>
    ),
  },
  {
    number: "12",
    title: "Your Rights",
    content: (
      <div className="space-y-3">
        <P>Subject to applicable law (including the GDPR if you are in the EEA/UK), you have the right to:</P>
        <Bullet
          items={[
            "Access the personal data we hold about you and receive a copy",
            "Correct inaccurate data",
            "Have your data deleted, including your account",
            "Restrict or object to processing, including analytics and product announcements",
            "Receive your data in a portable format",
            "Withdraw consent at any time, where processing is based on consent",
          ]}
        />
        <P>
          To exercise any of these rights, email{" "}
          <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
            anything@goo-fashion.com
          </a>{" "}
          from the address linked to your account. We respond within 30 days. You can also lodge a complaint
          with the Ukrainian Parliament Commissioner for Human Rights or, in the EEA, with your local data
          protection authority.
        </P>
      </div>
    ),
  },
  {
    number: "13",
    title: "Children",
    content: (
      <P>
        Goo Fashion is not directed at children under 16, and we do not knowingly collect their personal
        data. If you believe a child has provided us personal data, contact us and we will delete it.
      </P>
    ),
  },
  {
    number: "14",
    title: "Changes to This Policy",
    content: (
      <P>
        We may update this policy from time to time. The current version is always published on this page
        with its &ldquo;last updated&rdquo; date; material changes will be announced on the website or by email.
      </P>
    ),
  },
  {
    number: "15",
    title: "Contact",
    content: (
      <P>
        Questions about privacy? Contact us at{" "}
        <a href="mailto:anything@goo-fashion.com" className="text-[var(--foreground)] link-underline">
          anything@goo-fashion.com
        </a>
        .
      </P>
    ),
  },
];

export default function PrivacyPage() {
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
              Privacy Policy
            </h1>
            <p className="text-sm text-[var(--foreground-subtle)]">
              Last updated: August 10, 2026
            </p>
          </div>

          {/* Intro */}
          <div className="mb-16 pb-16 border-b border-[var(--border)]">
            <p className="text-base text-[var(--foreground-muted)] leading-relaxed">
              Goo Fashion respects your privacy. This policy explains, in plain language, exactly what
              personal data we collect, why we collect it, which service providers it is shared with, and the
              rights you have over it.
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
            <Link href="/cookie" className="text-xs tracking-[0.12em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors link-underline">
              Cookie Policy
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
