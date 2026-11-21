import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    changedPaths,
    e2eSuites,
    examplesFrameworks,
    FRAMEWORKS,
    needOf,
} from "../../scripts/e2e-suites.ts";

// From Splitter (fragiola/splitter, site/tests/e2e-suites.test.ts), same author and licence.
// CI's `changes` job runs scripts/e2e-suites.ts against the pull request's base. The examples apps
// are given: React's today, and the three the adapter Epics add.
const EXAMPLES = ["angular", "react", "svelte", "vue"];
const ALL = { playground: true, examples: EXAMPLES };

describe("the E2E suites a change runs", () => {
    it("knows the four adapter frameworks", () => {
        expect([...FRAMEWORKS].sort()).toEqual(EXAMPLES);
    });

    it("runs none for the docs", () => {
        expect(
            e2eSuites(
                [
                    "site/docs/guides/features.mdx",
                    "AGENTS.md",
                    "README.md",
                    "packages/core/README.md",
                    "examples/vue/README.md",
                ],
                EXAMPLES,
            ),
        ).toEqual({ playground: false, examples: [] });
    });

    it("runs the playground and React's examples for React", () => {
        expect(
            e2eSuites(
                [
                    "packages/react/src/components/flow.tsx",
                    "examples/react/src/examples/basic/index.tsx",
                ],
                EXAMPLES,
            ),
        ).toEqual({ playground: true, examples: ["react"] });
    });

    it("runs only an adapter's examples for Vue, Svelte or Angular", () => {
        expect(
            e2eSuites(["packages/vue/src/components/flow.ts"], EXAMPLES),
        ).toEqual({ playground: false, examples: ["vue"] });
        expect(
            e2eSuites(
                [
                    "packages/svelte/src/components/flow.svelte",
                    "examples/svelte/src/examples/basic/index.svelte",
                ],
                EXAMPLES,
            ),
        ).toEqual({ playground: false, examples: ["svelte"] });
        expect(
            e2eSuites(
                [
                    "packages/angular/src/lib/directives/flow.directive.ts",
                    "examples/angular/src/examples/basic/index.ts",
                    "site/docs/index.mdx",
                ],
                EXAMPLES,
            ),
        ).toEqual({ playground: false, examples: ["angular"] });
        expect(
            e2eSuites(
                [
                    "packages/vue/src/index.ts",
                    "packages/angular/src/public-api.ts",
                ],
                EXAMPLES,
            ),
        ).toEqual({ playground: false, examples: ["angular", "vue"] });
    });

    it("runs every suite for anything else: it is an allow-list of what may skip", () => {
        for (const path of [
            "packages/core/src/index.ts",
            "packages/core/package.json",
            "examples/shared/e2e/basic.spec.ts",
            "apps/playground/src/app.tsx",
            "pnpm-lock.yaml",
            "package.json",
            "biome.json",
            ".github/workflows/ci.yml",
            "scripts/e2e-suites.ts",
            "site/export.ts",
            "site/tests/e2e-suites.test.ts",
            "packages/solid/src/index.ts",
            "examples/solid/src/main.ts",
            "packages/react",
            "something/new.ts",
        ]) {
            expect(needOf(path), path).toBe("all");
            expect(
                e2eSuites(["packages/vue/src/index.ts", path], EXAMPLES),
                path,
            ).toEqual(ALL);
        }
    });

    it("runs only the suites that exist", () => {
        expect(e2eSuites(["packages/vue/src/index.ts"], ["react"])).toEqual({
            playground: false,
            examples: [],
        });
        expect(e2eSuites(["packages/core/src/index.ts"], [])).toEqual({
            playground: true,
            examples: [],
        });
    });

    it("runs none for no change", () => {
        expect(e2eSuites([], EXAMPLES)).toEqual({
            playground: false,
            examples: [],
        });
    });
});

describe("the examples apps", () => {
    it("are the examples/<framework> folders with a playwright.config.ts", () => {
        const dir = mkdtempSync(join(tmpdir(), "flow-examples-"));
        try {
            for (const name of ["vue", "react", "shared"]) {
                mkdirSync(join(dir, name));
            }
            writeFileSync(join(dir, "vue", "playwright.config.ts"), "");
            writeFileSync(join(dir, "react", "playwright.config.ts"), "");
            expect(examplesFrameworks(dir)).toEqual(["react", "vue"]);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("are none without an examples/ folder", () => {
        expect(examplesFrameworks(join(tmpdir(), "flow-no-such-dir"))).toEqual(
            [],
        );
    });

    it("are React's, Svelte's and Vue's in this repository today (examples/shared has no suite of its own)", () => {
        expect(examplesFrameworks()).toEqual(["react", "svelte", "vue"]);
    });
});

describe("the changed paths", () => {
    it("lists a moved file at both its paths, so moving core code runs every suite", () => {
        const dir = mkdtempSync(join(tmpdir(), "flow-diff-"));
        const git = (...args: string[]) =>
            execFileSync("git", args, { cwd: dir, encoding: "utf8" });
        try {
            git("init", "--quiet");
            git("config", "user.email", "test@example.com");
            git("config", "user.name", "test");
            git("config", "commit.gpgsign", "false");
            mkdirSync(join(dir, "packages", "core", "src"), {
                recursive: true,
            });
            writeFileSync(
                join(dir, "packages", "core", "src", "moved.ts"),
                "export const moved = 1;\n",
            );
            git("add", ".");
            git("commit", "--quiet", "-m", "base");
            mkdirSync(join(dir, "packages", "react", "src"), {
                recursive: true,
            });
            git(
                "mv",
                "packages/core/src/moved.ts",
                "packages/react/src/moved.ts",
            );
            git("commit", "--quiet", "-m", "move");
            const paths = changedPaths("HEAD^1", dir).sort();
            expect(paths).toEqual([
                "packages/core/src/moved.ts",
                "packages/react/src/moved.ts",
            ]);
            expect(e2eSuites(paths, EXAMPLES)).toEqual(ALL);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
