"use client";

import { useTheme } from "@/lib/context/theme-context";

interface HeroBackgroundProps {
  darkUrl: string;
  lightUrl: string;
}

export default function HeroBackground({ darkUrl, lightUrl }: HeroBackgroundProps) {
  const { theme } = useTheme();
  const url = theme === "light" ? lightUrl : darkUrl;

  return (
    <div
      className="absolute inset-0 bg-cover bg-center"
      style={{ backgroundImage: `url(${url})` }}
    />
  );
}
