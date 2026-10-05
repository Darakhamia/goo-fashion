import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // The sign-in page lives at /login. `/sign-in` is Clerk's default path and has
  // never existed here, so linking to it is a silent 404 in the middle of the
  // payment funnel — that is what kept anyone from subscribing. Fail the lint
  // instead of letting the dead route creep back in.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/^\\/sign-in(\\?|#|\\/|$)/]",
          message: "Route /sign-in does not exist — use /login.",
        },
        {
          selector: "TemplateElement[value.raw=/^\\/sign-in(\\?|#|\\/|$)/]",
          message: "Route /sign-in does not exist — use /login.",
        },
      ],
    },
  },
  // The extension is plain browser script with no type checker behind it, so a
  // name used and never defined only shows up when an admin clicks the button:
  // 1.0.7 shipped a popup whose Start threw "note is not a function". The
  // TypeScript preset switches `no-undef` off; for these files it is the check.
  {
    files: ["extension/**/*.js"],
    languageOptions: {
      globals: Object.fromEntries(
        [
          "chrome", "window", "document", "location", "navigator", "console", "fetch", "URL",
          "AbortController", "setTimeout", "clearTimeout", "setInterval", "clearInterval",
          "getComputedStyle", "Node", "Element", "HTMLElement", "NodeFilter", "crypto",
        ].map((name) => [name, "readonly"]),
      ),
    },
    rules: { "no-undef": "error" },
  },
  // The admin screenshot stand is Node tooling run with plain `node` (CommonJS),
  // not app code: it loads its fixtures with require().
  {
    files: ["scripts/admin-screens/**/*.js"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Catalog photos are hosted on the retailers' CDNs, which rate-limit Next's
  // image optimizer and answer 429 — the product then renders as alt text.
  // @/components/ui/Image decides per host whether the optimizer may be used;
  // a raw next/image import silently opts back out of that decision.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    ignores: ["src/components/ui/Image.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/image",
              message:
                "Import Image from @/components/ui/Image — partner-CDN photos must render unoptimized.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
