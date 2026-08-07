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
]);

export default eslintConfig;
