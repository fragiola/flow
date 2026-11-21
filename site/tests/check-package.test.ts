import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    ADAPTERS,
    corePinProblem,
    exportProblems,
    publishedExportsProblems,
    relativeTo,
    servedImports,
    smokeVersion,
    unlistedPackages,
    withoutSource,
} from "../../scripts/check-package.ts";
import { SOURCE_CONDITION } from "../../scripts/source-condition.ts";

// From Splitter (fragiola/splitter, site/tests/check-package.test.ts), same author and licence.
// `pnpm check:package` runs scripts/check-package.ts over the packed packages.
describe("the packed package check", () => {
    const published = {
        ".": {
            types: "./dist/index.d.ts",
            import: "./dist/index.js",
            default: "./dist/index.js",
        },
        "./package.json": "./package.json",
    };
    const repo = {
        ".": { [SOURCE_CONDITION]: "./src/index.ts", ...published["."] },
        "./package.json": "./package.json",
    };

    it("accepts dist-only exports with the types, import and default conditions", () => {
        expect(exportProblems(published)).toEqual([]);
    });

    it("rejects any other condition, and a target outside dist", () => {
        expect(
            exportProblems({
                ".": {
                    "@fragiola/source": "./src/index.ts",
                    development: "./dist/index.js",
                    "@acme/anything": "./dist/index.js",
                    import: "./dist/index.js",
                },
            }),
        ).toEqual([
            'exports["."]: the "@fragiola/source" condition is published',
            'exports["."]["@fragiola/source"]: "./src/index.ts" is not in dist',
            'exports["."]: the "development" condition is published',
            'exports["."]: the "@acme/anything" condition is published',
        ]);
        expect(exportProblems(undefined)).toHaveLength(1);
    });

    it("takes the published exports for the repo's, without the source condition", () => {
        expect(withoutSource(repo)).toEqual(published);
        expect(publishedExportsProblems(repo, published)).toEqual([]);
    });

    it("finds published exports that drifted from the repo's", () => {
        const { default: _, ...noDefault } = published["."];
        expect(
            publishedExportsProblems(repo, { ...published, ".": noDefault }),
        ).toHaveLength(1);
        expect(
            publishedExportsProblems(repo, {
                ...published,
                "./extra": "./dist/extra.js",
            }),
        ).toHaveLength(1);
        expect(
            publishedExportsProblems(repo, {
                ".": { ...published["."], import: "./dist/other.js" },
                "./package.json": "./package.json",
            }),
        ).toHaveLength(1);
    });

    it("takes a package packed from its build output as publishing that directory's files", () => {
        // ng-packagr's output: packed from dist (publishConfig.directory), targets relative to it
        const angularRepo = {
            ".": {
                [SOURCE_CONDITION]: "./src/public-api.ts",
                types: "./dist/types/x.d.ts",
                default: "./dist/fesm2022/x.mjs",
            },
            "./package.json": "./package.json",
        };
        const packed = {
            ".": { types: "./types/x.d.ts", default: "./fesm2022/x.mjs" },
            "./package.json": "./package.json",
        };
        expect(
            publishedExportsProblems(relativeTo(angularRepo, "dist"), packed),
        ).toEqual([]);
        const files = new Set(["./types/x.d.ts", "./fesm2022/x.mjs"]);
        expect(
            exportProblems(packed, "exports", (target) => files.has(target)),
        ).toEqual([]);
        expect(
            exportProblems(
                { ".": { default: "./src/public-api.ts" } },
                "exports",
                (target) => files.has(target),
            ),
        ).toHaveLength(1);
        // a package packed from its folder keeps its dist targets
        expect(relativeTo(published, "out")).toEqual(published);
    });

    it("lists the absolute imports of a module the dev server served", () => {
        expect(
            servedImports(
                'import "/@vite/client";\nimport { Flow } from "/node_modules/.vite/deps/x.js?v=1";\nimport React from "react";',
            ),
        ).toEqual(["/@vite/client", "/node_modules/.vite/deps/x.js?v=1"]);
    });

    it("passes on the core's own manifest", () => {
        const core = JSON.parse(
            readFileSync(
                join(import.meta.dirname, "../../packages/core/package.json"),
                "utf8",
            ),
        ) as { exports: unknown; publishConfig: { exports: unknown } };
        expect(exportProblems(core.publishConfig.exports)).toEqual([]);
        expect(
            publishedExportsProblems(core.exports, core.publishConfig.exports),
        ).toEqual([]);
    });
});

// Every package under packages/ but the core is an adapter, and each adapter is checked the same
// way: its exact core pin and its own smoke app. Each adapter Epic adds its entry to ADAPTERS.
describe("the adapters the package check covers", () => {
    it("are every package of packages/ but the core, React first", () => {
        const dirs = readdirSync(join(import.meta.dirname, "../../packages"));
        expect(dirs).toContain("core");
        expect(unlistedPackages(dirs)).toEqual([]);
        expect(ADAPTERS.map((adapter) => adapter.dir).sort()).toEqual(
            dirs.filter((dir) => dir !== "core").sort(),
        );
        expect(ADAPTERS[0]?.dir).toBe("react");
    });

    it("smoke-test each adapter with its own framework's app", () => {
        expect(ADAPTERS.map(({ dir, framework }) => [dir, framework])).toEqual([
            ["react", "react"],
        ]);
    });

    it("pin the React smoke app at the examples app's versions, so it installs nothing new", () => {
        const app = JSON.parse(
            readFileSync(
                join(import.meta.dirname, "../../examples/react/package.json"),
                "utf8",
            ),
        ) as {
            dependencies: Record<string, string>;
            devDependencies: Record<string, string>;
        };
        const pins = { ...app.dependencies, ...app.devDependencies };
        for (const name of [
            "react",
            "react-dom",
            "@types/react",
            "@types/react-dom",
            "@vitejs/plugin-react",
            "typescript",
            "vite",
        ]) {
            expect(smokeVersion("react", name), name).toBe(pins[name]);
        }
        expect(() => smokeVersion("react", "left-pad")).toThrow(/no pin/);
    });

    it("finds a package that is neither the core nor a listed adapter", () => {
        const dirs = ["core", "react", "vue", "solid"];
        expect(unlistedPackages(dirs)).toEqual(["vue", "solid"]);
        expect(
            unlistedPackages(dirs, [
                ...ADAPTERS,
                { dir: "vue", framework: "vue", smoke: async () => {} },
            ]),
        ).toEqual(["solid"]);
    });

    it("require each adapter to pin the core at its exact version", () => {
        const adapter = (pin?: string) => ({
            name: "@fragiola/flow-react",
            ...(pin ? { dependencies: { "@fragiola/flow": pin } } : {}),
        });
        expect(corePinProblem(adapter("1.2.3"), "1.2.3")).toBeUndefined();
        expect(corePinProblem(adapter("^1.2.3"), "1.2.3")).toBe(
            '@fragiola/flow-react depends on the core at "^1.2.3", not at 1.2.3',
        );
        expect(corePinProblem(adapter(), "1.2.3")).toMatch(/"undefined"/);
    });
});
