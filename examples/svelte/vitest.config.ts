import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";
import { examplesTestResolve } from "./vite.shared.ts";

export default defineConfig({
    // components compile as in the app
    plugins: [svelte()],
    // the packages from their sources, not their dist, in either environment
    ...examplesTestResolve(),
    test: {
        name: "examples-svelte",
        // the contract tests read files; the kit test renders on the server
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
