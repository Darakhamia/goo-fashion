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
  // box gives up its own border, fill and shadow and just flows.
  //
  // The `!` suffix is Tailwind v4's important modifier, and here it is load
  // bearing rather than decoration. Clerk paints these boxes with emotion, which
  // injects into <head> after the app stylesheet, so a plain utility of equal
  // specificity loses. Colour and type classes happen to win anyway; fills and
  // frames do not. Only those are marked — everything else stays a plain class so
  // Clerk keeps its own internal rhythm.
  //
  // Clerk's horizontal padding is deliberately left alone. Zeroing it once put
  // the heading flush against `cardBox`, which carries a radius and
  // `overflow: hidden`, and the first glyph came out shaved. The wordmark and the
  // legal links are centred on the column instead, so they line up on the card's
  // centre and nothing has to sit on its edge.
  //
  // Phones (mockup v2 «Б · Вход») restyle the form with `max-md:` classes, and
  // every one of those carries `!`. Clerk's emotion rules are unlayered, so
  // they beat Tailwind's layered utilities whatever the specificity — type
  // included: on the stand the title measured Clerk's 18px, not `text-3xl`.
  // On a phone the card also drops its 40px side padding so the form runs the
  // column's full width; `overflow-visible` keeps a first glyph that now sits on
  // the box's edge from being shaved (see above).
  rootBox: "w-full",
  cardBox: "w-full max-w-none border-0! bg-transparent! shadow-none! max-md:overflow-visible! max-md:rounded-none!",
  card: "w-full border-0! bg-transparent! shadow-none! pt-0! max-md:px-0! max-md:pb-0! max-md:gap-6!",
  scrollBox: "bg-transparent! shadow-none!",

  // Clerk owns this heading on every step ("Sign in to GOO-Fashion", "Check
  // your email", …), so it is restyled rather than replaced — hiding it would
  // strip the only label the multi-factor and verification steps carry.
  header: "items-start text-left gap-2",
  // `tracking-[-0.015em]!` at every width: it is the value globals.css gives a
  // bare `text-3xl`, and naming any tracking class here switches that rule off.
  headerTitle:
    "text-3xl font-bold leading-tight tracking-[-0.015em]! text-[var(--foreground)] max-md:text-[26px]! max-md:font-semibold! max-md:leading-[1.2]!",
  headerSubtitle:
    "text-sm leading-relaxed text-[var(--foreground-muted)] max-md:text-[15px]! max-md:leading-[1.45]!",

  main: "max-md:gap-[18px]!",
  socialButtons: "gap-2",
  // Phones: a 50px pill on the surface, framed by an inset ring (mockup v2).
  // The ring reads `--auth-border`, not `--border`: Clerk declares its own
  // `--border` on its buttons, and inside them the site's token is shadowed.
  socialButtonsBlockButton:
    "h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-none hover:border-[var(--foreground)] hover:bg-[var(--surface)] transition-colors duration-200 max-md:h-[50px]! max-md:rounded-full! max-md:border-0! max-md:bg-[var(--surface)]! max-md:shadow-[inset_0_0_0_1px_var(--auth-border)]!",
  socialButtonsBlockButtonText:
    "text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] max-md:text-[15px]! max-md:normal-case max-md:tracking-normal!",
  // Informational-chip recipe, taken to 10px: the scale's floor is 10, and the
  // 9px chips elsewhere in the code sit below it.
  lastAuthenticationStrategyBadge:
    "text-[10px] tracking-[0.16em] uppercase rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground-muted)] px-2 py-1 max-md:text-[11px]! max-md:normal-case max-md:tracking-normal!",

  dividerLine: "bg-[var(--border)]",
  dividerText:
    "text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] max-md:text-[13px]! max-md:normal-case max-md:tracking-normal! max-md:font-normal! max-md:text-[var(--foreground-muted)]!",

  form: "max-md:gap-3.5!",
  formFieldLabel:
    "text-[10px] uppercase tracking-[0.14em] text-[var(--foreground-muted)] mb-1.5 max-md:text-[13px]! max-md:normal-case max-md:tracking-normal! max-md:font-normal! max-md:text-[var(--foreground-muted)]!",
  // text-base below md is deliberate: 16px stops iOS zooming the page on focus.
  // It only takes with `!` (Clerk's 14px won before). Phones: a 50px field on
  // the page, framed by a ring that turns to the foreground on focus; `!` on the
  // radius and outline also beats the global `:focus-visible` (2px radius).
  formFieldInput:
    "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-base md:text-[13px] text-[var(--foreground)] placeholder:text-[var(--foreground-subtle)] shadow-none outline-none focus:border-[var(--border-strong)] transition-colors max-md:h-[50px]! max-md:max-h-none! max-md:rounded-[14px]! max-md:px-3.5! max-md:py-0! max-md:text-base! max-md:bg-transparent! max-md:shadow-[inset_0_0_0_1px_var(--border-strong)]! max-md:focus:shadow-[inset_0_0_0_1px_var(--foreground)]! max-md:outline-none!",
  formFieldInputShowPasswordButton:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors",
  formFieldAction:
    "text-[11px] text-[var(--foreground-muted)] hover:text-[var(--foreground)] underline underline-offset-4 transition-colors",
  formButtonPrimary:
    "h-11 rounded-xl bg-[var(--foreground)] text-[var(--background)] shadow-none text-xs tracking-[0.14em] uppercase font-medium hover:opacity-80 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed max-md:h-[50px]! max-md:rounded-full! max-md:text-base! max-md:font-semibold! max-md:normal-case max-md:tracking-normal! max-md:shadow-none! max-md:after:bg-none!",
  // The ▸ after "Continue": phones show the bare word, as in the mockup.
  buttonArrowIcon: "max-md:hidden!",
  formResendCodeLink: "text-[var(--foreground)] underline underline-offset-4",

  otpCodeFieldInput:
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",

  identityPreview: "rounded-xl border border-[var(--border)] bg-[var(--surface)]",
  identityPreviewText: "text-[13px] text-[var(--foreground)]",
  identityPreviewEditButton:
    "text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors",

  alternativeMethodsBlockButton:
    "h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-none hover:border-[var(--foreground)] transition-colors duration-200 max-md:h-[50px]! max-md:rounded-full! max-md:border-0! max-md:bg-[var(--surface)]! max-md:shadow-[inset_0_0_0_1px_var(--auth-border)]!",
  alternativeMethodsBlockButtonText:
    "text-xs tracking-[0.14em] uppercase font-medium text-[var(--foreground)] max-md:text-[15px]! max-md:normal-case max-md:tracking-normal!",
  backLink:
    "text-[11px] tracking-[0.14em] uppercase text-[var(--foreground-muted)] hover:text-[var(--foreground)] transition-colors max-md:text-[14px]! max-md:normal-case max-md:tracking-normal!",

  // No status tokens exist in the system; these are the shapes the rest of the
  // site already uses for an error (report/page.tsx) and a success (admin).
  alert: "rounded-xl border border-red-500/25 bg-red-500/10",
  alertText: "text-[13px] text-red-400",
  formFieldErrorText: "text-[11px] text-red-400",
  formFieldSuccessText: "text-[11px] text-emerald-500",

  spinner: "text-[var(--foreground-muted)]",

  // The "Secured by Clerk" strip stays — it is required on the plan we are on.
  // Flattening its fill is enough to stop it reading as a detached grey bar. In
  // Clerk v6 the footer is a sibling of `card` inside `cardBox`, not a child, so
  // it has to be addressed on its own. `bg-none!` joins `bg-transparent!` here
  // because the strip survived a colour-only override on production — that only
  // clears `background-color`, and a gradient or image would sit through it.
  footer: "bg-transparent! bg-none! border-0! pt-6 shadow-none!",
  footerAction: "bg-transparent! bg-none!",
  footerActionText: "text-[13px] text-[var(--foreground-muted)]",
  footerActionLink:
    "text-[13px] text-[var(--foreground)] underline underline-offset-4 max-md:underline! max-md:underline-offset-[3px]!",
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
    // `--auth-border` pins the site's border token for Clerk's buttons (see
    // ELEMENTS): resolved here, it inherits past Clerk's own `--border`.
    <div className="min-h-screen bg-[var(--background)] [--auth-border:var(--border)] lg:grid lg:grid-cols-2">
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
      <div className="flex min-h-screen flex-col px-5 pt-2 pb-8 md:px-12 md:py-12">
        {/* One measure holds the wordmark, the form and the links on a single
            left edge, which is what makes the column read as a composed page
            instead of a card floating in the middle of the screen. */}
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col">
          {/* Wordmark and legal links are centred on the column, so they sit on
              the card's centre line. The form keeps its own left-aligned
              typography — Clerk's padding insets it evenly, so the two agree. */}
          {/* Phones: a top bar like the site header's on inner pages — a round
              back button on the left, the wordmark centred (mockup v2). The
              button goes home rather than back in history: after a Google
              round trip "back" would land on Google's own pages. */}
          <div className="shrink-0 text-center max-md:relative max-md:-mx-2 max-md:flex max-md:h-11 max-md:items-center max-md:justify-center">
            <Link
              href="/"
              aria-label="Back to GOO"
              className="md:hidden absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:border-[var(--foreground)]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <Link
              href="/"
              // Verbatim from the header wordmark (Navigation.tsx:146-150) so the
              // mark is the same one on every other page; the colour is a token
              // here because the header computes it in JS against the hero.
              style={{ fontFamily: "var(--font-poppins), sans-serif", fontWeight: 800 }}
              className="max-md:relative max-md:after:absolute max-md:after:inset-x-0 max-md:after:-inset-y-[9px] text-[17px] tracking-[0.16em] md:text-[22px] md:tracking-[0.18em] text-[var(--foreground)] hover:opacity-70 transition-opacity duration-200"
            >
              GOO
            </Link>
            {/* The panel carries the pitch on desktop; below `lg` it is gone, so
                one line of it stays behind under the wordmark — on tablets. Phones
                carry the pitch as three points under the form instead. */}
            <p className="mt-2 text-[10px] tracking-[0.18em] uppercase font-medium text-[var(--foreground-subtle)] max-md:hidden lg:hidden">
              Your personal AI stylist
            </p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
            // Phones: the form starts under the top bar instead of floating in
            // the middle; the points below take the bottom of the screen.
            className="flex flex-1 flex-col justify-center py-12 max-md:flex-none max-md:justify-start max-md:pt-10 max-md:pb-0"
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

          {/* Phones: the gradient panel's pitch, as three quiet points pinned
              to the bottom of the screen (mockup v2). */}
          <ul className="md:hidden mt-auto flex flex-col gap-3 pt-10">
            {PITCH.map((item) => (
              <li key={item.number} className="flex gap-3">
                <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--foreground-muted)]" />
                <span>
                  <span className="block text-[14px] font-medium text-[var(--foreground)]">{item.title}</span>
                  <span className="mt-px block text-[13px] leading-[1.4] text-[var(--foreground-muted)]">{item.body}</span>
                </span>
              </li>
            ))}
          </ul>

          {/* Phones: plain words, and no "Back to GOO" — the top bar has it. */}
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] tracking-[0.14em] uppercase text-[var(--foreground-subtle)] max-md:mt-6 max-md:gap-x-5 max-md:text-[12px] max-md:normal-case max-md:tracking-normal max-md:text-[var(--foreground-muted)]">
            <Link href="/" className="hover:text-[var(--foreground)] transition-colors max-md:hidden">
              Back to GOO
            </Link>
            <Link href="/terms" className="hover:text-[var(--foreground)] transition-colors max-md:-mx-2.5 max-md:px-2.5 max-md:py-[13px]">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[var(--foreground)] transition-colors max-md:-mx-2.5 max-md:px-2.5 max-md:py-[13px]">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
