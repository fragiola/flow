import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    chunksOf,
    FEATURES,
    featureLeaks,
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

    it("reads source maps and chunk imports", () => {
        expect(mapSources(undefined)).toEqual([]);
        expect(mapSources('{"sources":["a.ts",1]}')).toEqual(["a.ts"]);
        expect(
            chunksOf(
                'import { a } from "./a-1.js";\nimport("./b.js");\nimport "c";',
            ),
        ).toEqual(["a-1.js", "b.js"]);
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
    });
});
