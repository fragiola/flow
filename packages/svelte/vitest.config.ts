import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defaultClientConditions, defaultServerConditions } from "vite";
import { defineProject } from "vitest/config";
import { withSourceCondition } from "../../scripts/source-condition.ts";

export default defineProject({
    plugins: [svelte()],
    // the core from its sources (the source export condition), not its dist; Svelte's browser
    // runtime in jsdom (`mount` is client only), its server one for a test that opts into node
    resolve: {
        conditions: withSourceCondition(defaultClientConditions),
    },
    ssr: {
        resolve: { conditions: withSourceCondition(defaultServerConditions) },
    },
    test: {
        name: "svelte",
        environment: "jsdom",
        include: ["tests/**/*.test.ts"],
        setupFiles: ["tests/setup.ts"],
    },
});
