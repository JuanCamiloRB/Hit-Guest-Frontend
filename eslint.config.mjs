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
    // File-sync conflict copies. TypeScript excludes the same patterns in
    // tsconfig.json so a regenerated "routes.d 3.ts" cannot break builds.
    "**/* [0-9]*.ts",
    "**/* [0-9]*.tsx",
    "**/* [0-9]*.js",
    "**/* [0-9]*.jsx",
  ]),
]);

export default eslintConfig;
