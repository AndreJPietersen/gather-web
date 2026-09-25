import { defineConfig, globalIgnores } from "eslint/config";
import nextTs from "eslint-config-next/typescript";

// Lints the repo-level files (the e2e suites and Playwright config). Each
// app and package has its own eslint config and lints itself.
export default defineConfig([
  ...nextTs,
  globalIgnores(["apps/**", "node_modules/**", "e2e/.output/**"]),
]);
