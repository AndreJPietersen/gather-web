import { defineConfig } from "vitest/config";

// Everything in this package is pure TypeScript, so no browser environment.
export default defineConfig({
  test: { environment: "node" },
});
