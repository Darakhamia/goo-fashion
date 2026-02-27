import type { Metadata } from "next";
import "./globals.css";
import { LikesProvider } from "@/lib/context/likes-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { ThemeProvider } from "@/lib/context/theme-context";
import ConditionalSiteLayout from "@/components/layout/ConditionalSiteLayout";

export const metadata: Metadata = {
  title: "GOO — AI Stylist",
  description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
  keywords: ["fashion", "AI stylist", "outfits", "luxury fashion", "personal stylist"],
  openGraph: {
    title: "GOO — AI Stylist",
    description: "Your personal AI stylist. Curated outfits, premium fashion, one platform.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
        {/* Inline script prevents flash of wrong theme on load */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('goo-theme');if(t==='light'){document.documentElement.classList.remove('dark')}else{document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            <LikesProvider>
              <ConditionalSiteLayout>{children}</ConditionalSiteLayout>
            </LikesProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
