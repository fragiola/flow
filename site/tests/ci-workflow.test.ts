import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// From Splitter (fragiola/splitter, site/tests/ci-workflow.test.ts), same author and licence; the
// rules of the guidelines (repository.md#ci). The E2E jobs run in Playwright's image instead of
// installing the browsers: its browsers are the ones of its version, so the tag follows
// @playwright/test. A push to main runs the www trigger only (no test): every other job skips it.
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

/** The workflow's jobs, by id: each one's `if` (when it has one) and its `needs`. */
function jobs(
    source: string,
): Record<string, { if?: string; needs: string[] }> {
    const block = source.slice(source.search(/^jobs:\n/m));
    const found: Record<string, { if?: string; needs: string[] }> = {};
    for (const match of block.matchAll(
        /^ {2}([\w-]+):\n((?:(?: {4,}.*)?\n)*)/gm,
    )) {
        const [, id = "", body = ""] = match;
        const condition = /^ {4}if: (.+)$/m.exec(body)?.[1];
        const needs = /^ {4}needs: (.+)$/m.exec(body)?.[1] ?? "";
        found[id] = {
            ...(condition === undefined ? {} : { if: condition.trim() }),
            needs: needs
                .replace(/[[\]]/g, "")
                .split(",")
                .map((need) => need.trim())
                .filter((need) => need !== ""),
        };
    }
    return found;
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

    it("runs on pull requests, manual runs and pushes to main", () => {
        expect(triggers(workflow)).toEqual([
            "pull_request",
            "push",
            "workflow_dispatch",
        ]);
        expect(workflow).toMatch(/^ {2}push:\n {4}branches: \[main\]\n/m);
        expect(
            triggers(
                "on:\n  pull_request:\n  push:\n    branches: [main]\n\njobs:\n",
            ),
        ).toEqual(["pull_request", "push"]);
    });

    it("runs only the www trigger on a push to main: no tests", () => {
        const all = jobs(workflow);
        expect(Object.keys(all)).toEqual(
            expect.arrayContaining([
                "checks",
                "package",
                "changes",
                "site-export",
                "trigger-www-build",
            ]),
        );
        for (const [id, job] of Object.entries(all)) {
            if (id === "trigger-www-build") {
                expect(job.if).toBe(
                    "github.event_name == 'push' && github.ref == 'refs/heads/main'",
                );
                continue;
            }
            // skipped on a push itself, or needs a job that is (a skipped need skips it)
            const skipsPush = job.if === "github.event_name != 'push'";
            const needsOne = job.needs.some(
                (need) => all[need]?.if === "github.event_name != 'push'",
            );
            expect(skipsPush || needsOne, `${id} runs on a push`).toBe(true);
            // a skipped need skips a job only while its condition does not override it
            if (!skipsPush) {
                expect(job.if ?? "", id).not.toMatch(
                    /always\(\)|cancelled\(\)|failure\(\)/,
                );
            }
        }
        // a job condition is one line: a block scalar would hide it from the check
        expect(workflow).not.toMatch(/^ {4}if: [>|]/m);
        expect(
            jobs(
                "jobs:\n  a:\n    if: x\n    needs: b\n    steps:\n  b:\n    needs: [a, c]\n",
            ),
        ).toEqual({ a: { if: "x", needs: ["b"] }, b: { needs: ["a", "c"] } });
    });

    it("runs the site export with the /flow base, and dispatches project-updated to www", () => {
        expect(workflow).toContain(
            'pnpm site:export --base /flow --out "$RUNNER_TEMP/site-export"',
        );
        const trigger = workflow.slice(
            workflow.indexOf("  trigger-www-build:"),
        );
        expect(trigger).toContain("repos/fragiola/www/dispatches");
        expect(trigger).toContain("event_type=project-updated");
        expect(trigger).toContain("client_payload[slug]=flow");
        // skipped, not failed, without the secret
        expect(trigger).toMatch(
            /WWW_DISPATCH_TOKEN: \$\{\{ secrets\.WWW_DISPATCH_TOKEN \}\}/,
        );
        expect(trigger).toContain("if: env.WWW_DISPATCH_TOKEN != ''");
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
