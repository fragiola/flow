import { defineProject } from "vitest/config";

export default defineProject({
    test: {
        name: "core",
        // Node by default: the document and the model must load and run without a DOM.
        // Files that need one opt in with a `// @vitest-environment jsdom` docblock (jsdom comes with
        // the engine, fragiola/flow#3).
        environment: "node",
        include: ["tests/**/*.test.ts"],
    },
});
