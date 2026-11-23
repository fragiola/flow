// From Splitter (fragiola/splitter, examples/vue/tests/vendored.test.ts), same author and licence.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PENDING } from "examples-shared/e2e/available";
import { describe, expect, it } from "vitest";

// The Fragiola UI theme (the palettes, the base stylesheet), `cn` and the style families the Vue
// pieces use are vendored into examples/react by its scripts/vendor-fragiola.ts; this app copies
// them, so the Vue examples wear the React examples' classes. A copy is the original with its
// first line (the vendoring header) replaced. The plain TypeScript of examples/react's examples
// (React's components are `.tsx`) is copied with the adapter's name swapped
// (`@fragiola/flow-react` → `@fragiola/flow-vue`): the kit (`_kit/`, framework-free app policy),
// every example's `styles.ts` (the Vue markup binds the same classes to the same parts) and an
// example's data and rules. The Vue pieces themselves (`src/components/{atoms,ui}`) are ports,
// tested in kit.test.ts.

const here = join(import.meta.dirname, "..");
const react = join(here, "..", "react");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

/** This app's copy → examples/react's original. */
const COPIES: Record<string, string> = Object.fromEntries([
    ...listFiles(join(here, "src/styles"))
        .map((file) => relative(here, file))
        .map((file) => [file, file]),
    ["src/lib/cn.ts", "src/lib/cn.ts"],
    ...["foundation", "menu", "popup"].map((name) => [
        `src/components/families/${name}.ts`,
        `src/components/families/${name}.ts`,
    ]),
    // a `.tsx` without JSX there (the registry's basename rule), plain TypeScript here
    ["src/components/families/field.ts", "src/components/families/field.tsx"],
]);

const EXAMPLES = join(here, "src/examples");

/**
 * Siblings that differ on purpose: the workflow builder's catalog holds Vue icon components, and
 * its model reader is a composable (`use-workflow.ts`), not a React hook.
 */
const DIFFERENT = [
    "src/examples/workflow-builder/catalog.ts",
    "src/examples/workflow-builder/use-workflow.ts",
];

const SAME = listFiles(join(react, "src/examples"))
    .filter((file) => file.endsWith(".ts") && !file.endsWith(".generated.ts"))
    .map((file) => relative(react, file))
    .filter((file) => !DIFFERENT.includes(file))
    // an example a later Epic brings to this app (`PENDING`) has nothing here yet
    .filter((file) => !PENDING.vue.includes(file.split("/")[2] ?? ""));

const body = (source: string) => source.slice(source.indexOf("\n") + 1);

/** A React example file as this app writes it: the Vue adapter's name for React's. */
const asVue = (source: string) =>
    source.replaceAll("@fragiola/flow-react", "@fragiola/flow-vue");

describe("the files copied from examples/react", () => {
    it.each(Object.entries(COPIES))("%s", (copy, original) => {
        const copied = readFileSync(join(here, copy), "utf8");
        expect(copied.split("\n")[0]).toContain(
            `Copied from examples/react/${original}`,
        );
        expect(body(copied)).toBe(
            body(readFileSync(join(react, original), "utf8")),
        );
    });

    it("cover every palette examples/react vendors", () => {
        const names = (dir: string) => readdirSync(dir).sort();
        expect(names(join(here, "src/styles/palettes"))).toEqual(
            names(join(react, "src/styles/palettes")),
        );
    });

    it("include the kit, every example's styles.ts and its plain siblings", () => {
        expect(SAME).toContain("src/examples/_kit/undo.ts");
        expect(SAME).toContain("src/examples/_kit/persistence.ts");
        expect(SAME).toContain("src/examples/workflow-builder/rules.ts");
        for (const slug of readdirSync(EXAMPLES)) {
            if (slug === "_kit" || slug.endsWith(".md")) continue;
            expect(SAME).toContain(`src/examples/${slug}/styles.ts`);
        }
    });

    it.each(DIFFERENT)("%s, which differs on purpose, exists", (file) => {
        expect(statSync(join(here, file)).isFile()).toBe(true);
    });

    it.each(SAME)("%s, as it is", (file) => {
        expect(readFileSync(join(here, file), "utf8")).toBe(
            asVue(readFileSync(join(react, file), "utf8")),
        );
    });
});
