// From Splitter (fragiola/splitter, examples/vue/tests/examples.test.ts), same author and licence.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
    collectFiles,
    type ExampleEntry,
    examplesApp,
    importsOf,
    listExampleSlugs,
    loadExamples,
} from "examples-shared/scripts/examples-lib";
import { beforeAll, describe, expect, it } from "vitest";

// The Vue side of the example contract: an example is single-file components (`index.vue` its
// entry), `styles.ts` and plain TypeScript siblings, importing only what a consumer can copy:
// `vue`, the Vue package and its feature entries, `@lucide/vue`, the Fragiola UI pieces
// (`#/components/…`, `#/lib/cn`) and relative files inside examples/. Every example assembles the
// flow itself, keeps the id it has in examples/react, and binds its classes from `styles.ts`. What
// every framework shares (the metadata) is checked in examples/shared/tests.

const APP = examplesApp("vue");
const EXAMPLES_DIR = APP.examplesDir;
const KIT = join(EXAMPLES_DIR, "_kit");

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^vue$/,
    // the Vue package re-exports the core and mirrors every feature's entry: an example never
    // imports @fragiola/flow
    /^@fragiola\/flow-vue(\/(selection|subflows|drag|resize|connection|reconnection|keyboard|minimap))?$/,
    /^@lucide\/vue$/,
    /^#\/components\/(ui|atoms)\/[a-z-]+$/,
    /^#\/lib\/cn$/,
];

/** Whether an example may import `specifier` (relative files aside). */
function allowed(specifier: string): boolean {
    return ALLOWED.some((pattern) => pattern.test(specifier));
}

/** Site files under examples/ that are not example code. */
const SITE_FILES = [/\.generated\.ts$/, /\.md$/, /\.css$/];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

/** A component's template: what follows its first `<template>`. */
function templateOf(source: string): string {
    const start = source.indexOf("<template>");
    return start === -1 ? "" : source.slice(start);
}

/** Where a template styles itself instead of binding `styles.ts`: a `class="…"` or a `cn()`. */
function inlineClasses(template: string): string[] {
    return [
        ...template.matchAll(/\sclass="[^"]*"|:class="[^"]*['`][^"]*"|\bcn\(/g),
    ].map((match) => match[0]);
}

let examples: ExampleEntry[] = [];
beforeAll(async () => {
    examples = await loadExamples(APP);
});

describe("the Vue examples", () => {
    const slugs = listExampleSlugs(APP);

    it("are all in the manifest, each with a valid meta", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(slugs);
    });

    it("are every example of examples/react, with the same ids", () => {
        // Vue is a complete framework (examples/shared/e2e/available.ts): it ships every example
        expect(slugs.length).toBeGreaterThan(0);
        // #36: React's examples this app has not got yet; its #36 helper adds them and empties this
        const aheadInReact = ["connected-data"];
        expect(slugs).toEqual(
            listExampleSlugs(examplesApp("react")).filter(
                (slug) => !aheadInReact.includes(slug),
            ),
        );
    });

    it("import only what a consumer can copy", () => {
        const files = walk(EXAMPLES_DIR)
            .map((file) => relative(EXAMPLES_DIR, file))
            .filter(
                (file) => !SITE_FILES.some((pattern) => pattern.test(file)),
            );
        for (const file of files) {
            const source = readFileSync(join(EXAMPLES_DIR, file), "utf-8");
            for (const specifier of importsOf(source)) {
                if (specifier.startsWith(".")) continue;
                expect(
                    allowed(specifier),
                    `${file} imports "${specifier}"`,
                ).toBe(true);
            }
        }
    });

    it("refuses `@/`, the core, React's package and anything else a consumer lacks", () => {
        expect(allowed("@/lib/cn")).toBe(false);
        expect(allowed("@fragiola/flow")).toBe(false);
        expect(allowed("@fragiola/flow/drag")).toBe(false);
        expect(allowed("@fragiola/flow-react")).toBe(false);
        expect(allowed("@fragiola/flow-vue/nope")).toBe(false);
        expect(allowed("lucide-react")).toBe(false);
        expect(allowed("examples-shared/themes")).toBe(false);
        expect(allowed("@fragiola/flow-vue")).toBe(true);
        expect(allowed("@fragiola/flow-vue/minimap")).toBe(true);
        expect(allowed("#/components/ui/select")).toBe(true);
    });

    it.each(slugs)("%s shows its entry first in the code panel", (slug) => {
        const { files } = collectFiles(APP, slug);
        expect(files[0]).toBe(`${slug}/index.vue`);
        expect(examples.find((e) => e.slug === slug)?.files).toEqual(files);
    });

    it.each(slugs)("%s assembles the flow itself: <Flow.Root>", (slug) => {
        const source = readFileSync(
            join(EXAMPLES_DIR, slug, "index.vue"),
            "utf-8",
        );
        expect(templateOf(source)).toMatch(/<Flow\.Root\b/);
    });

    it.each(slugs)("%s keeps class strings out of its templates", (slug) => {
        expect(
            statSync(join(EXAMPLES_DIR, slug, "styles.ts"), {
                throwIfNoEntry: false,
            })?.isFile(),
        ).toBe(true);
        for (const file of walk(join(EXAMPLES_DIR, slug))) {
            if (!file.endsWith(".vue")) continue;
            // looks go in styles.ts and are bound (`:class="styles.part"`)
            expect(
                inlineClasses(templateOf(readFileSync(file, "utf-8"))),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });

    it("finds inline classes the styles.ts rule forbids", () => {
        expect(inlineClasses('<div class="flex" />')).toHaveLength(1);
        expect(inlineClasses('<div :class="cn(a, b)" />')).toHaveLength(1);
        expect(
            inlineClasses(`<div :class="on ? 'a' : styles.b" />`),
        ).toHaveLength(1);
        expect(
            inlineClasses(
                '<div :class="styles.cell" /><p :class="styles.dot(tone)" />',
            ),
        ).toEqual([]);
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!/\.(ts|vue)$/.test(file)) continue;
            expect(
                readFileSync(file, "utf-8"),
                relative(EXAMPLES_DIR, file),
            ).not.toMatch(/\.adapter\b/);
        }
    });
});

describe("the Vue kit", () => {
    it("renders no Flow primitive: the examples assemble the flow", () => {
        for (const file of walk(KIT)) {
            expect(
                importsOf(readFileSync(file, "utf-8")).filter((specifier) =>
                    specifier.startsWith("@fragiola/flow-vue"),
                ),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });

    it("holds no styles: classes live in each example's styles.ts", () => {
        for (const file of walk(KIT)) {
            if (!file.endsWith(".vue")) continue;
            expect(
                inlineClasses(templateOf(readFileSync(file, "utf-8"))),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });
});
