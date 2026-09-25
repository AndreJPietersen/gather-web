import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Without test.globals enabled in vitest.config.ts, RTL's own automatic
// cleanup registration can't find a global afterEach to hook into, so
// unmounted-but-still-rendered elements from a previous test leak into the
// next one in the same file — explicit registration here is what actually
// resets jsdom's document body between tests.
afterEach(cleanup);
