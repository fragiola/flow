// From Splitter (fragiola/splitter, scripts/e2e-suites.ts), same author and licence; the rules of
// the guidelines (repository.md#ci). The E2E suites a change can affect: CI's `changes` job runs it
// and gives the E2E jobs its outputs. Only what is known to be safe skips a suite: the docs skip
// every suite, an adapter's package (or its examples app) runs only that adapter's suites, and any
// other path runs them all. The E2E jobs (the playground, and a matrix over the examples apps)
// read its outputs.
//
//   node scripts/e2e-suites.ts --diff <base>   the files changed between <base> and HEAD
//   node scripts/e2e-suites.ts --all           every suite (a manual run)
//   node scripts/e2e-suites.ts <file>…         the given files (to try the rules locally)
//
// It prints the selection and, in CI, writes `playground` (true | false) and `examples` (a JSON
// array of frameworks) to `$GITHUB_OUTPUT`.
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

/**
 * The frameworks whose package (`packages/<framework>`) and examples app (`examples/<framework>`)
 * run only their own suites. The playground is a React app, so React's run it too.
 */
export const FRAMEWORKS: readonly string[] = [
    "react",
    "vue",
    "svelte",
    "angular",
];

/** The suites to run: the playground's, and the examples apps' by framework. */
export interface E2eSuites {
    playground: boolean;
    examples: string[];
}

/** What one changed path asks for: nothing, some suites, or every suite. */
type Need = "none" | "all" | { playground: boolean; framework: string };

/** The docs: no suite reads them. */
function isDocs(path: string): boolean {
    return (
        path.startsWith("site/docs/") ||
        path.endsWith(".md") ||
        path === "AGENTS.md"
    );
}

/**
 * What one changed path needs. React's package and its examples (which the playground renders in
 * place) run the playground and examples react; Vue's, Svelte's and Angular's run only their own
 * examples suite. Everything else (the core, examples/shared, the playground, the lockfile, the
 * root configs, .github, scripts, site) runs every suite.
 */
export function needOf(path: string): Need {
    if (isDocs(path)) {
        return "none";
    }
    const match = /^(packages|examples)\/([^/]+)\//.exec(path);
    const framework = match?.[2];
    if (framework !== undefined && FRAMEWORKS.includes(framework)) {
        return { playground: framework === "react", framework };
    }
    return "all";
}

/**
 * The suites a set of changed paths runs, among the examples apps the repository has
 * (`examples`, in the order given).
 */
export function e2eSuites(
    paths: readonly string[],
    examples: readonly string[],
): E2eSuites {
    let playground = false;
    const chosen = new Set<string>();
    for (const path of paths) {
        const need = needOf(path);
        if (need === "all") {
            return { playground: true, examples: [...examples] };
        }
        if (need !== "none") {
            playground ||= need.playground;
            chosen.add(need.framework);
        }
    }
    return {
        playground,
        examples: examples.filter((framework) => chosen.has(framework)),
    };
}

/**
 * The frameworks with an examples app: every examples/<framework> with a playwright.config.ts
 * (React's today; examples/shared has none: every app runs its specs).
 */
export function examplesFrameworks(dir = join(root, "examples")): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir)
        .filter((name) => existsSync(join(dir, name, "playwright.config.ts")))
        .sort();
}

/**
 * The paths a diff against `base` touches. Renames are off: a moved file lists both its old and
 * its new path, so a file moved out of the core (or into the docs) still runs every suite.
 */
export function changedPaths(base: string, cwd = root): string[] {
    return execFileSync(
        "git",
        ["diff", "--name-only", "--no-renames", base, "HEAD"],
        { cwd, encoding: "utf8" },
    )
        .split("\n")
        .filter((path) => path !== "");
}

function main(args: readonly string[]): void {
    const examples = examplesFrameworks();
    let suites: E2eSuites;
    if (args[0] === "--all") {
        suites = { playground: true, examples };
    } else {
        const paths =
            args[0] === "--diff"
                ? changedPaths(args[1] ?? "HEAD^1")
                : [...args];
        console.log(
            `changed files (${paths.length}):\n  ${paths.join("\n  ")}`,
        );
        suites = e2eSuites(paths, examples);
    }
    const outputs = {
        playground: String(suites.playground),
        examples: JSON.stringify(suites.examples),
    };
    const lines = Object.entries(outputs).map(
        ([key, value]) => `${key}=${value}`,
    );
    console.log(lines.join("\n"));
    if (process.env.GITHUB_OUTPUT) {
        appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join("\n")}\n`);
    }
}

// only when run, not when a test imports it
if (import.meta.main) {
    main(process.argv.slice(2));
}
