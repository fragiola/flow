import { defineConfig } from "tsdown";

/** The opt-in features, each its own entry (`@fragiola/flow-react/<feature>`, `src/<feature>/index.ts`). */
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
    // the main entry and one entry per feature, mirrored from the core's: the main entry never
    // imports a feature's code (scripts/check-features.ts checks the built chunks)
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
    // the declarations are built from src only: tsconfig.json also takes in the tests and the
    // configs, which import the repo's scripts/, and their declarations would be written there
    tsconfig: "tsconfig.build.json",
});
