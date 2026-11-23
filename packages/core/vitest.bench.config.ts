import { defineConfig } from "vitest/config";

// The large-flow micro-benchmark (`pnpm --filter @fragiola/flow bench`), apart from `pnpm test`:
// its timings depend on the machine, so it prints them and asserts nothing about them.
export default defineConfig({
    test: {
        name: "core-bench",
        environment: "jsdom",
        include: ["tests/**/*.bench.ts"],
        testTimeout: 120_000,
        // the table is the output
        silent: false,
    },
});
