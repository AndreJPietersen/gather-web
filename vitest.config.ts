import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// Per Next.js's own Vitest guide (node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md):
// async Server Components aren't supported here — every page.tsx in this
// project is an async Server Component, so they're deliberately out of
// scope for this config and stay covered by the Playwright verification
// already run manually each phase. This config is for synchronous Client
// Components (src/components/ui/*, form components) and pure functions
// (src/lib/utils.ts) only.
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
  },
});
