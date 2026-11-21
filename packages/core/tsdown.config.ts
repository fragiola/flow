import { defineConfig } from "tsdown";

/** The opt-in features, each its own entry (`@fragiola/flow/<feature>`, `src/<feature>/index.ts`). */
const FEATURES = [
    "selection",
    "subflows",
    "drag",
    "resize",
    "connection",
    "reconnection",
    "keyboard",
    "minimap",
] as const;

export default defineConfig({
    // the main entry and one entry per feature: the main entry never imports a feature's code
    // (scripts/check-features.ts checks the built chunks through their source maps)
    entry: {
        index: "src/index.ts",
        ...Object.fromEntries(
            FEATURES.map((feature) => [feature, `src/${feature}/index.ts`]),
        ),
    },
    format: "esm",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: true,
});
