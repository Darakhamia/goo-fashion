import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "var(--foreground)",
            colorBackground: "var(--background)",
            colorText: "var(--foreground)",
            colorInputBackground: "var(--surface)",
            colorInputText: "var(--foreground)",
            fontFamily: "inherit",
            borderRadius: "0px",
          },
          elements: {
            card: "shadow-none border border-[var(--border)] bg-[var(--background)]",
            headerTitle: "text-[var(--foreground)] font-light tracking-[0.1em]",
            headerSubtitle: "text-[var(--foreground-muted)]",
            formButtonPrimary:
              "bg-[var(--foreground)] text-[var(--background)] hover:opacity-80 transition-opacity rounded-none text-xs tracking-[0.14em] uppercase font-medium",
            formFieldInput:
              "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-none focus:ring-0 focus:border-[var(--foreground)]",
            footerActionLink: "text-[var(--foreground)] underline underline-offset-2",
            dividerLine: "bg-[var(--border)]",
            dividerText: "text-[var(--foreground-muted)]",
          },
        }}
        redirectUrl="/"
        signUpUrl="/register"
      />
    </div>
  );
}
