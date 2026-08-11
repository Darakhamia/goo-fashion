"use client";

import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { useTheme } from "@/lib/context/theme-context";

/**
 * Sign-in / sign-up, laid out as a page of this site rather than a Clerk card
 * dropped into an empty screen.
 *
 * The screen splits in two above `lg`: the left half is a monochrome gradient
 * panel carrying a short pitch for GOO, and the form sits in a right-hand
 * editorial column that shares one left edge with the wordmark and the legal
 * links. The panel comes first in the markup as well as on screen, so reading
 * order matches visual order; it holds no focusable element, so tab order still
 * lands in the form first. Below `lg` the panel is dropped and the column runs
 * full width — the same way every other decorative panel on the site behaves on
 * a phone.
 *
 * Two layers do the Clerk theming, and they are split on purpose:
 *
 * - `elements` are real CSS classes, so they read the site's custom properties
 *   (`--surface`, `--foreground`, …) and follow the light/dark switch for free.
 * - `variables` are parsed by Clerk to derive hover and alpha shades, so they
 *   have to be literal colours. Those we pick per resolved theme instead — a
 *   `var(...)` here would come back as an unparseable colour.
 */

type Palette = {
  colorPrimary: string;
  colorBackground: string;
  colorText: string;
  colorTextSecondary: string;
  colorTextOnPrimaryBackground: string;
  colorInputBackground: string;
  colorInputText: string;
  colorNeutral: string;
  colorBorder: string;
  colorRing: string;
};

// Mirrors the `:root` / `.dark` blocks in globals.css. `colorBackground` is the
// page background, not `--surface`: the card is transparent now, so every shade
// Clerk derives for hover and focus has to sit on what is actually behind it.
const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    colorPrimary: "#0A0A0A",
    colorBackground: "#F4F2EE",
    colorText: "#0A0A0A",
    colorTextSecondary: "#6B6B6B",
    colorTextOnPrimaryBackground: "#F4F2EE",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#0A0A0A",
    colorNeutral: "#0A0A0A",
    colorBorder: "#E8E6E0",
    colorRing: "#C0BEB8",
  },
  dark: {
    colorPrimary: "#F0EEE8",
    colorBackground: "#0A0A0A",
    colorText: "#F0EEE8",
    colorTextSecondary: "#888884",
    colorTextOnPrimaryBackground: "#0A0A0A",
    colorInputBackground: "#141414",
    colorInputText: "#F0EEE8",
    colorNeutral: "#F0EEE8",
    colorBorder: "#222220",
    colorRing: "#3A3A38",
  },
};

const ELEMENTS = {
  // The card stops being a card: the column around it does the framing, so the
  // box gives up its own border, fill, shadow and padding and just flows.
  //
  // The `!` suffix is Tailwind v4's important modifier, and here it is load
  // bearing rather than decoration. Clerk paints these boxes with emotion, which
  // injects into <head> after the app stylesheet, so a plain utility of equal
  // specificity loses. Colour and type classes happen to win anyway; box
  // geometry and fills do not, and Clerk's own `card` padding was pushing the
  // form ~2rem to the right of the wordmark and the legal links above and below
  // it. Only the properties that have to beat Clerk are marked — everything else
  // stays a plain class so Clerk keeps its own internal rhythm.
  // px-0! on all three boxes Clerk nests: whichever of them carries the inset,
  // the content ends up flush with the column. Padding cannot go negative, so
  // zeroing one that had none is a no-op rather than an overshoot.
  rootBox: "w-full",
  cardBox: "w-full max-w-none border-0! bg-transparent! shadow-none! px-0!",
  card: "w-full border-0! bg-transparent! shadow-none! px-0! pt-0!",
  main: "px-0!",
  scrollBox: "bg-transparent! shadow-none! px-0!",

  // Clerk owns this heading on every step ("Sign in to GOO-Fashion", "Check
  // your email", …), so it is restyled rather than replaced — hiding it would
  // strip the only label the multi-factor and verification steps carry.
  header: "items-start text-left gap-2",
  headerTitle: "text-3xl font-bold leading-tight text-[var(--foreground)]",
  headerSubtitle: "text-sm leading-relaxed text-[var(--foreground-muted)]",

  socialButtons: "gap-2",
  socialButtonsBlockButton:
    "h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-none hover:border-[var(--foreground)] hover:bg-[var(--surface)] transition-colors duration-200",
  socialButtonsBlockButtonText:
    "text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)]",
  // Informational-chip recipe, taken to 10px: the scale's floor is 10, and the
  // 9px chips elsewhere in the code sit below it.
  lastAuthenticationStrategyBadge:
    "text-[10px] tracking-[0.16em] uppercase rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)] px-2 py-1",

  dividerLine: "bg-[var(--border)]",
  dividerText:
    "text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]",

  formFieldLabel:
    "text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5",
  // text-base below md is deliberate: 16px stops iOS zooming the page on focus.
  formFieldInput:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base md:text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] shadow-none outline-none focus:border-[var(--border-strong)] transition-colors",
  formFieldInputShowPasswordButton:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors",
  formFieldAction:
    "text-[11px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline underline-offset-4 transition-colors",
  formButtonPrimary:
    "h-11 rounded-xl bg-[var(--foreground)] text-[var(--background)] shadow-none text-xs tracking-[0.14em] uppercase font-medium hover:opacity-80 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed",
  formResendCodeLink: "text-[var(--foreground)] underline underline-offset-4",

  otpCodeFieldInput:
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",

  identityPreview: "rounded-xl border border-[var(--border)] bg-[var(--surface)]",
  identityPreviewText: "text-[13px] text-[var(--foreground)]",
  identityPreviewEditButton:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors",

  alternativeMethodsBlockButton:
    "h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-none hover:border-[var(--foreground)] transition-colors duration-200",
  alternativeMethodsBlockButtonText:
    "text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)]",
  backLink:
    "text-[11px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors",

  // No status tokens exist in the system; these are the shapes the rest of the
  // site already uses for an error (report/page.tsx) and a success (admin).
  alert: "rounded-xl border border-red-500/25 bg-red-500/10",
  alertText: "text-[13px] text-red-400",
  formFieldErrorText: "text-[11px] text-red-400",
  formFieldSuccessText: "text-[11px] text-emerald-500",

  spinner: "text-[var(--foreground-muted)]",

  // The "Secured by Clerk" strip stays — it is required on the plan we are on.
  // Flattening its fill is enough to stop it reading as a detached grey bar, and
  // that fill is another one Clerk sets itself, so it needs the `!` too. In Clerk
  // v6 the footer is a sibling of `card` inside `cardBox`, not a child of it, so
  // zeroing the card's padding does not reach it.
  footer: "bg-transparent! border-0! px-0! pt-6 shadow-none!",
  footerAction: "bg-transparent! px-0!",
  footerActionText: "text-[13px] text-[var(--foreground-muted)]",
  footerActionLink: "text-[13px] text-[var(--foreground)] underline underline-offset-4",
  footerPages: "bg-transparent",
  footerPagesLink: "text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]",
} as const;

/**
 * The panel gradient. Monochrome on purpose — the site has no accent colour, so
 * depth comes from the overlay tokens, which already flip per theme: the same
 * stack reads as a soft light bloom on `#141414` and as a soft shadow on white.
 * It lives in `style` rather than a class because Tailwind arbitrary values do
 * not take a comma-separated stack of gradients; the values are still tokens.
 */
const PANEL_GRADIENT = [
  "linear-gradient(208deg, var(--fg-overlay-05) 0%, transparent 45%)",
  // Two blooms share the top-left corner — the outer edge of the screen, so the
  // panel darkens towards the seam and frames the form. The tight one compounds
  // over the wide one, taking the peak past what a single 8% token reaches.
  "radial-gradient(52% 38% at 12% 2%, var(--fg-overlay-08) 0%, transparent 62%)",
  "radial-gradient(120% 88% at 16% 4%, var(--fg-overlay-08) 0%, transparent 58%)",
  "radial-gradient(96% 74% at 94% 100%, var(--fg-overlay-08) 0%, transparent 62%)",
  "radial-gradient(62% 52% at 0% 94%, var(--fg-overlay-05) 0%, transparent 60%)",
  "var(--surface)",
].join(", ");

const PANEL_GRAIN = "radial-gradient(circle, var(--fg-overlay-05) 1px, transparent 1px)";

// Condensed from /about, so the two pages make the same promises in the same words.
const PITCH = [
  {
    number: "01",
    title: "Generate outfits instantly",
    body: "Describe a vibe — the AI composes a full look and renders it.",
  },
  {
    number: "02",
    title: "Build it by hand",
    body: "Drag pieces from 50+ brands into a single look in the builder.",
  },
  {
    number: "03",
    title: "See it before you buy",
    body: "Every outfit rendered on a mannequin or as a flat-lay, not imagined.",
  },
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { theme } = useTheme();

  const appearance = {
    variables: {
      ...PALETTES[theme],
      fontFamily: "inherit",
      fontSize: "14px",
      // 12px = rounded-xl, the radius the rest of the site's controls sit on.
      borderRadius: "12px",
    },
    elements: ELEMENTS,
  };

  return (
    <div className="min-h-screen bg-[var(--background)] lg:grid lg:grid-cols-2">
      {/* ── Gradient panel ──────────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden border-r border-[var(--border)] lg:sticky lg:top-0 lg:block lg:h-screen">
        <div aria-hidden className="absolute inset-0" style={{ background: PANEL_GRADIENT }} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: PANEL_GRAIN, backgroundSize: "22px 22px" }}
        />

        <div className="relative flex h-full flex-col px-12 py-12 xl:px-16">
          <p className="shrink-0 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
            Why GOO
          </p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-1 flex-col justify-center py-10"
          >
            <div className="max-w-[440px]">
              {/* A <p>, not a heading: Clerk already renders the page's h1 in the
                  card next to it, and this is brand copy, not page structure. */}
              <p className="text-4xl xl:text-5xl font-black uppercase leading-[1.05] text-[var(--foreground)]">
                Style, simplified
                <br />
                by intelligence.
              </p>
              <p className="mt-6 text-sm leading-relaxed text-[var(--foreground-muted)]">
                One platform, one AI — everything you need to go from idea to outfit.
              </p>

              <ul className="mt-10 border-t border-[var(--border)]">
                {PITCH.map((item) => (
                  <li
                    key={item.number}
                    className="flex gap-5 border-b border-[var(--border)] py-5"
                  >
                    <span className="w-6 shrink-0 pt-0.5 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)]">
                      {item.number}
                    </span>
                    <div>
                      <p className="text-[15px] font-semibold leading-snug text-[var(--foreground)]">
                        {item.title}
                      </p>
                      <p className="mt-1 text-[13px] leading-relaxed text-[var(--foreground-muted)]">
                        {item.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </aside>

      {/* ── Form column ─────────────────────────────────────────────────────── */}
      <div className="flex min-h-screen flex-col px-6 py-10 md:px-12 md:py-12">
        {/* One measure holds the wordmark, the form and the links on a single
            left edge, which is what makes the column read as a composed page
            instead of a card floating in the middle of the screen. */}
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
          <div className="shrink-0">
            <Link
              href="/"
              // Verbatim from the header wordmark (Navigation.tsx:146-150) so the
              // mark is the same one on every other page; the colour is a token
              // here because the header computes it in JS against the hero.
              style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 800 }}
              className="text-[22px] tracking-[0.18em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
            >
              GOO
            </Link>
            {/* The panel carries the pitch on desktop; on a phone it is gone, so
                one line of it stays behind under the wordmark. */}
            <p className="mt-2 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] lg:hidden">
              Your personal AI stylist
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="flex flex-1 flex-col justify-center py-12"
          >
            {mode === "login" ? (
              <SignIn
                appearance={appearance}
                signUpUrl="/register"
                // `fallbackRedirectUrl`, not `redirectUrl`: the payment funnel arrives here
                // as `/login?redirect_url=/subscribe?plan=basic` and has to land back on
                // that page. A plain `redirectUrl` outranks the query parameter and would
                // drop every paying customer on the homepage instead.
                fallbackRedirectUrl="/"
              />
            ) : (
              <SignUp appearance={appearance} signInUrl="/login" fallbackRedirectUrl="/" />
            )}
          </motion.div>

          <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)]">
            <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
              Back to GOO
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
