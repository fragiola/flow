import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// From Splitter (fragiola/splitter, site/tests/ci-workflow.test.ts), same author and licence; the
// rules of the guidelines (repository.md#ci). The E2E jobs run in Playwright's image instead of
// installing the browsers: its browsers are the ones of its version, so the tag follows
// @playwright/test. There is no E2E job and no Playwright pin yet (they arrive with the apps in
// the React Epic): the checks hold for whatever the repository has.
const root = join(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const workflow = read(".github/workflows/ci.yml");

/** The apps that may run Playwright: apps/* and examples/*, those that exist. */
function playwrightApps(): string[] {
    return ["apps", "examples"].flatMap((folder) =>
        existsSync(join(root, folder))
            ? readdirSync(join(root, folder))
                  .map((name) => `${folder}/${name}`)
                  .filter((dir) => existsSync(join(root, dir, "package.json")))
            : [],
    );
}

/** The @playwright/test versions the apps pin. */
function playwrightVersions(): Set<string> {
    return new Set(
        playwrightApps().flatMap((dir) => {
            const manifest = JSON.parse(read(`${dir}/package.json`)) as {
                devDependencies?: Record<string, string>;
            };
            const version = manifest.devDependencies?.["@playwright/test"];
            return version === undefined ? [] : [version];
        }),
    );
}

/** The Playwright image tags the workflow's jobs run in. */
function imageTags(source: string): string[] {
    return [
        ...source.matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/g),
    ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));
}

/** The workflow's top-level `on:` events. */
function triggers(source: string): string[] {
    const block = /^on:\n((?:[ \t]+.*\n|\n)*)/m.exec(source)?.[1] ?? "";
    return [...block.matchAll(/^ {2}([a-z_]+):/gm)].flatMap((match) =>
        match[1] === undefined ? [] : [match[1]],
    );
}

describe("the CI workflow", () => {
    it("runs the E2E jobs in the image of the Playwright the suites use", () => {
        const versions = playwrightVersions();
        const images = imageTags(workflow);
        expect(versions.size).toBeLessThanOrEqual(1);
        // a pinned Playwright needs an E2E job in its image, and an image needs a pin
        expect(images.length > 0).toBe(versions.size > 0);
        expect(new Set(images)).toEqual(versions);
    });

    it("reads the image tags", () => {
        expect(
            imageTags(
                "image: mcr.microsoft.com/playwright:v1.63.0-noble\n  image: mcr.microsoft.com/playwright:v1.62.1-noble",
            ),
        ).toEqual(["1.63.0", "1.62.1"]);
    });

    it("installs no browser", () => {
        expect(workflow).not.toContain("playwright install");
    });

    it("runs on pull requests and manual runs only: a push to main runs no tests", () => {
        expect(triggers(workflow)).toEqual([
            "pull_request",
            "workflow_dispatch",
        ]);
        expect(
            triggers(
                "on:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n",
            ),
        ).toEqual(["pull_request", "push"]);
    });

    it("picks the E2E suites from the merge commit's first parent, everything on a manual run", () => {
        expect(workflow).toMatch(/fetch-depth:\s*2\b/);
        expect(workflow).toContain("node scripts/e2e-suites.ts --diff HEAD^1");
        expect(workflow).toContain("node scripts/e2e-suites.ts --all");
    });

    it("has no release or Changesets job, and no release workflow (AGENTS.md, D15)", () => {
        expect(workflow).not.toMatch(/^\s*(?:-\s*)?run:.*changeset/im);
        expect(workflow).not.toMatch(/^\s+name:\s*(?:Changesets|Release)\b/im);
        expect(readdirSync(join(root, ".github/workflows"))).toEqual([
            "ci.yml",
        ]);
        expect(existsSync(join(root, ".changeset"))).toBe(false);
    });
});
