import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#0A0A0A",
            colorBackground: "#F4F2EE",
            colorText: "#0A0A0A",
            colorTextSecondary: "#6B6B6B",
            colorInputBackground: "#FFFFFF",
            colorInputText: "#0A0A0A",
            colorNeutral: "#0A0A0A",
            fontFamily: "inherit",
            borderRadius: "0px",
          },
          elements: {
            card: "shadow-none border border-[#E8E6E0] bg-[#F4F2EE]",
            headerTitle: "font-light tracking-[0.1em]",
            headerSubtitle: "text-[#6B6B6B]",
            formButtonPrimary:
              "bg-[#0A0A0A] text-[#F4F2EE] hover:opacity-80 transition-opacity rounded-none text-xs tracking-[0.14em] uppercase font-medium",
            formFieldInput:
              "border-[#E8E6E0] bg-white text-[#0A0A0A] text-base rounded-none focus:ring-0 focus:border-[#0A0A0A]",
            footerActionLink: "text-[#0A0A0A] underline underline-offset-2",
            dividerLine: "bg-[#E8E6E0]",
            dividerText: "text-[#6B6B6B]",
            socialButtonsBlockButton: "border-[#E8E6E0] rounded-none",
          },
        }}
        redirectUrl="/"
      />
    </div>
  );
}
