import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    chunksOf,
    FEATURES,
    featureLeaks,
    mainEntryOf,
    mapSources,
} from "../../scripts/check-features.ts";

// `pnpm build` runs scripts/check-features.ts over every package's built main entry: it fails when
// one ships a feature's code. These pin the check itself on planted builds, then on the real one.

/** A build of named files and their source maps, as the guard reads a `dist`. */
function built(
    files: Record<string, string>,
    maps: Record<string, readonly string[]> = {},
) {
    return {
        read: (name: string) => files[name],
        readMap: (name: string) =>
            maps[name] && JSON.stringify({ version: 3, sources: maps[name] }),
    };
}

const root = join(import.meta.dirname, "..", "..");

describe("the features' bundle guard", () => {
    it("lists every feature entry of the core's package.json", () => {
        const pkg = JSON.parse(
            readFileSync(join(root, "packages/core/package.json"), "utf8"),
        ) as { exports: Record<string, unknown> };
        const subpaths = Object.keys(pkg.exports)
            .filter((key) => key !== "." && key !== "./package.json")
            .map((key) => key.slice(2));
        expect(FEATURES.map((feature) => feature.subpath)).toEqual(subpaths);
    });

    it("covers the adapters' feature entries too: each mirrors the core's", () => {
        for (const pkg of readdirSync(join(root, "packages"))) {
            const manifest = JSON.parse(
                readFileSync(
                    join(root, "packages", pkg, "package.json"),
                    "utf8",
                ),
            ) as { exports: Record<string, unknown> };
            const subpaths = Object.keys(manifest.exports)
                .filter((key) => key !== "." && key !== "./package.json")
                .map((key) => key.slice(2));
            for (const subpath of subpaths) {
                expect(
                    FEATURES.map((feature) => feature.subpath),
                    `${pkg}: ${subpath}`,
                ).toContain(subpath);
            }
        }
    });

    it("fails an adapter's main entry built from the adapter's own feature folder", () => {
        const { read, readMap } = built(
            {
                "index.js":
                    'import { m } from "./mini-map-1.js";\nexport { m };',
                "mini-map-1.js": "export const m = 1;",
            },
            {
                "index.js": ["../src/index.ts"],
                "mini-map-1.js": ["../src/minimap/mini-map.tsx"],
            },
        );
        expect(featureLeaks("index.js", read, readMap)).toEqual([
            "mini-map-1.js: minimap's ../src/minimap/mini-map.tsx",
        ]);
    });

    it("passes a main entry, and its chunks, built from the core's own sources", () => {
        const { read, readMap } = built(
            {
                "index.js": 'import { a } from "./rules-1.js";\nexport { a };',
                "rules-1.js": "export const a = 1;",
            },
            {
                "index.js": [
                    "../src/index.ts",
                    "../src/model/create-flow-model.ts",
                ],
                "rules-1.js": ["../src/commands/rules.ts"],
            },
        );
        expect(featureLeaks("index.js", read, readMap)).toEqual([]);
    });

    it("fails a planted import: a chunk of the main entry built from a feature's folder", () => {
        const { read, readMap } = built(
            {
                "index.js": 'import { s } from "./shared-1.js";\nexport { s };',
                "shared-1.js": "export const s = 1;",
            },
            {
                "index.js": ["../src/index.ts"],
                "shared-1.js": ["../src/selection/commands.ts"],
            },
        );
        expect(featureLeaks("index.js", read, readMap)).toEqual([
            "shared-1.js: selection's ../src/selection/commands.ts",
        ]);
    });

    it("fails a main entry that imports a feature's entry point", () => {
        const { read, readMap } = built({
            "index.js": 'export { subflows } from "@fragiola/flow/subflows";',
        });
        expect(featureLeaks("index.js", read, readMap)).toEqual([
            "index.js: imports the subflows entry",
        ]);
    });

    it("ignores a feature's own entry, which the main entry does not import", () => {
        const { read, readMap } = built(
            {
                "index.js": "export const core = 1;",
                "minimap.js": "export const minimap = 1;",
            },
            { "minimap.js": ["../src/minimap/minimap.ts"] },
        );
        expect(featureLeaks("index.js", read, readMap)).toEqual([]);
    });

    it("follows an unbundled build (svelte-package) through its folders, each file its own source", () => {
        const { read, readMap } = built({
            "index.js": 'export * as Flow from "./parts.js";',
            "parts.js":
                'export { default as Node } from "./components/node.svelte";',
            "components/node.svelte":
                '<script>import { x } from "../utils/render.js";\nimport M from "../minimap/mini-map.svelte";</script>',
            "utils/render.js": "export const x = 1;",
            "minimap/mini-map.svelte": "<svg></svg>",
        });
        expect(featureLeaks("index.js", read, readMap, FEATURES, true)).toEqual(
            [
                "minimap/mini-map.svelte: minimap's ../src/minimap/mini-map.svelte",
            ],
        );
        // the same build without the planted import passes
        const clean = (file: string) =>
            file === "components/node.svelte"
                ? '<script>import { x } from "../utils/render.js";</script>'
                : read(file);
        expect(
            featureLeaks("index.js", clean, readMap, FEATURES, true),
        ).toEqual([]);
    });

    it("fails the real Svelte build when its main entry imports a feature (a planted import)", () => {
        const dist = join(root, "packages/svelte/dist");
        if (!existsSync(join(dist, "index.js"))) {
            execFileSync(
                "pnpm",
                ["--filter", "@fragiola/flow-svelte", "build"],
                {
                    cwd: root,
                    stdio: "ignore",
                },
            );
        }
        const read = (file: string) => {
            const path = join(dist, file);
            return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        };
        const noMap = () => undefined;
        expect(featureLeaks("index.js", read, noMap, FEATURES, true)).toEqual(
            [],
        );
        const planted = (file: string) =>
            file === "components/root.svelte"
                ? `<script>import "../minimap/index.js";</script>\n${read(file) ?? ""}`
                : read(file);
        expect(
            featureLeaks("index.js", planted, noMap, FEATURES, true).some(
                (leak) => leak.startsWith("minimap/index.js: minimap's"),
            ),
        ).toBe(true);
    }, 120_000);

    it("reads source maps and chunk imports", () => {
        expect(mapSources(undefined)).toEqual([]);
        expect(mapSources('{"sources":["a.ts",1]}')).toEqual(["a.ts"]);
        expect(
            chunksOf(
                'import { a } from "./a-1.js";\nimport("./b.js");\nimport "c";',
            ),
        ).toEqual(["a-1.js", "b.js"]);
        expect(
            chunksOf(
                'import { x } from "../utils/x.js";\nimport N from "./components/node.svelte";',
            ),
        ).toEqual(["../utils/x.js", "components/node.svelte"]);
    });

    it("fails the real build when the main entry imports a feature (a planted import)", () => {
        const dist = join(root, "packages/core/dist");
        if (!existsSync(join(dist, "index.js"))) {
            execFileSync("pnpm", ["--filter", "@fragiola/flow", "build"], {
                cwd: root,
                stdio: "ignore",
            });
        }
        const read = (file: string) => {
            const path = join(dist, file);
            return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        };
        const readMap = (file: string) => read(`${file}.map`);
        expect(featureLeaks("index.js", read, readMap)).toEqual([]);
        // the same build, its main entry importing the selection entry's chunk
        const planted = (file: string) =>
            file === "index.js"
                ? `import "./selection.js";\n${read(file) ?? ""}`
                : read(file);
        expect(
            featureLeaks("index.js", planted, readMap).some((leak) =>
                leak.startsWith("selection.js: selection's ../src/selection/"),
            ),
        ).toBe(true);
    }, 120_000);

    it("finds each package's main entry from its published exports (ng-packagr's FESM bundle)", () => {
        const manifest = (pkg: string) =>
            JSON.parse(
                readFileSync(
                    join(root, "packages", pkg, "package.json"),
                    "utf8",
                ),
            ) as { publishConfig?: { exports?: unknown } };
        expect(mainEntryOf(manifest("core"))).toBe("index.js");
        expect(mainEntryOf(manifest("react"))).toBe("index.js");
        expect(mainEntryOf(manifest("angular"))).toBe(
            "fesm2022/fragiola-flow-angular.mjs",
        );
    });

    it("fails the real Angular build when its main entry ships a feature (planted)", () => {
        const dist = join(root, "packages/angular/dist");
        const main = "fesm2022/fragiola-flow-angular.mjs";
        if (!existsSync(join(dist, main))) {
            // The core only when it is missing, and never with `...`: rebuilding it cleans
            // packages/core/dist while other test files (command-docs) read it in parallel.
            if (!existsSync(join(root, "packages/core/dist/index.js"))) {
                execFileSync("pnpm", ["--filter", "@fragiola/flow", "build"], {
                    cwd: root,
                    stdio: "ignore",
                });
            }
            execFileSync(
                "pnpm",
                ["--filter", "@fragiola/flow-angular", "build"],
                { cwd: root, stdio: "ignore" },
            );
        }
        const read = (file: string) => {
            const path = join(dist, file);
            return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        };
        const readMap = (file: string) => read(`${file}.map`);
        expect(featureLeaks(main, read, readMap)).toEqual([]);
        // the main bundle importing the minimap's entry, or built from its folder
        const imports = (file: string) =>
            file === main
                ? `import "@fragiola/flow-angular/minimap";\n${read(file) ?? ""}`
                : read(file);
        expect(featureLeaks(main, imports, readMap)).toContain(
            `${main}: imports the minimap entry`,
        );
        const plantedMap = (file: string) =>
            file === main
                ? JSON.stringify({
                      version: 3,
                      sources: [
                          ...mapSources(readMap(main)),
                          "../../src/minimap/mini-map.directive.ts",
                      ],
                  })
                : readMap(file);
        expect(featureLeaks(main, read, plantedMap)).toContain(
            `${main}: minimap's ../../src/minimap/mini-map.directive.ts`,
        );
    }, 120_000);
});
