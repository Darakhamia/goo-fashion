"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useTheme } from "@/lib/context/theme-context";

/**
 * Clerk's sign-in / sign-up card, dressed as part of the site.
 *
 * Two layers do the theming, and they are split on purpose:
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
};

// Mirrors the `:root` / `.dark` blocks in globals.css.
const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    colorPrimary: "#0A0A0A",
    colorBackground: "#FFFFFF",
    colorText: "#0A0A0A",
    colorTextSecondary: "#6B6B6B",
    colorTextOnPrimaryBackground: "#F4F2EE",
    colorInputBackground: "#F4F2EE",
    colorInputText: "#0A0A0A",
    colorNeutral: "#0A0A0A",
  },
  dark: {
    colorPrimary: "#F0EEE8",
    colorBackground: "#141414",
    colorText: "#F0EEE8",
    colorTextSecondary: "#888884",
    colorTextOnPrimaryBackground: "#0A0A0A",
    colorInputBackground: "#0A0A0A",
    colorInputText: "#F0EEE8",
    colorNeutral: "#F0EEE8",
  },
};

const ELEMENTS = {
  card: "shadow-none border border-[var(--border)] bg-[var(--surface)]",
  headerTitle: "font-light tracking-[0.1em] text-[var(--foreground)]",
  headerSubtitle: "text-[var(--foreground-muted)]",
  formButtonPrimary:
    "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity rounded-none text-xs tracking-[0.14em] uppercase font-medium",
  formFieldLabel: "text-[var(--foreground-muted)]",
  formFieldInput:
    "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] text-base rounded-none focus:ring-0 focus:border-[var(--border-strong)]",
  formFieldInputShowPasswordButton: "text-[var(--foreground-muted)]",
  formResendCodeLink: "text-[var(--foreground)]",
  otpCodeFieldInput: "border-[var(--border)] text-[var(--foreground)] rounded-none",
  identityPreviewText: "text-[var(--foreground)]",
  identityPreviewEditButton: "text-[var(--foreground)]",
  footerActionText: "text-[var(--foreground-muted)]",
  footerActionLink: "text-[var(--foreground)] underline underline-offset-2",
  dividerLine: "bg-[var(--border)]",
  dividerText: "text-[var(--foreground-muted)]",
  socialButtonsBlockButton:
    "border-[var(--border)] text-[var(--foreground)] rounded-none hover:bg-[var(--background)]",
  socialButtonsBlockButtonText: "text-[var(--foreground)]",
} as const;

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { theme } = useTheme();

  const appearance = {
    variables: {
      ...PALETTES[theme],
      fontFamily: "inherit",
      borderRadius: "0px",
    },
    elements: ELEMENTS,
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-16">
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
    </div>
  );
}
