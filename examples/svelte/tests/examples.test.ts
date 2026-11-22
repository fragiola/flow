// examples/vue/tests/examples.test.ts for the Svelte app.
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

// The Svelte side of the example contract: an example is components (`index.svelte` its entry),
// `styles.ts`, plain TypeScript siblings and `.svelte.ts` ones (runes), importing only what a
// consumer can copy: `svelte`, the Svelte package and its feature entries, `@lucide/svelte`, the
// Fragiola UI pieces
// (`#/components/…`, `#/lib/cn`) and relative files inside examples/. Every example assembles the
// flow itself, keeps the id it has in examples/react, and binds its classes from `styles.ts`. What
// every framework shares (the metadata) is checked in examples/shared/tests.

const APP = examplesApp("svelte");
const EXAMPLES_DIR = APP.examplesDir;
const KIT = join(EXAMPLES_DIR, "_kit");

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^svelte$/,
    // the Svelte package re-exports the core and mirrors every feature's entry: an example never
    // imports @fragiola/flow
    /^@fragiola\/flow-svelte(\/(selection|subflows|drag|resize|connection|reconnection|keyboard|minimap))?$/,
    /^@lucide\/svelte$/,
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

/** A component's markup: the file without its `<script>` and `<style>` blocks. */
function markupOf(source: string): string {
    return source.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g, "");
}

/**
 * Where markup styles itself instead of binding `styles.ts`: a `class="…"`, a string inside
 * `class={…}`, a `class:` directive or a `cn()`.
 */
function inlineClasses(markup: string): string[] {
    return [
        ...markup.matchAll(
            /\sclass="[^"]*"|\sclass=\{[^}]*['"`][^}]*\}|\sclass:[\w-]+|\bcn\(/g,
        ),
    ].map((match) => match[0]);
}

let examples: ExampleEntry[] = [];
beforeAll(async () => {
    examples = await loadExamples(APP);
});

describe("the Svelte examples", () => {
    const slugs = listExampleSlugs(APP);

    it("are all in the manifest, each with a valid meta", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(slugs);
    });

    it("are every example of examples/react, with the same ids", () => {
        // Svelte is a complete framework (examples/shared/e2e/available.ts): it ships every example
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

    it("refuses `@/`, the core, React's and Vue's packages and anything else a consumer lacks", () => {
        expect(allowed("@/lib/cn")).toBe(false);
        expect(allowed("@fragiola/flow")).toBe(false);
        expect(allowed("@fragiola/flow/drag")).toBe(false);
        expect(allowed("@fragiola/flow-react")).toBe(false);
        expect(allowed("@fragiola/flow-vue")).toBe(false);
        expect(allowed("@fragiola/flow-svelte/nope")).toBe(false);
        expect(allowed("lucide-react")).toBe(false);
        expect(allowed("@lucide/vue")).toBe(false);
        expect(allowed("svelte/store")).toBe(false);
        expect(allowed("examples-shared/themes")).toBe(false);
        expect(allowed("@fragiola/flow-svelte")).toBe(true);
        expect(allowed("@fragiola/flow-svelte/minimap")).toBe(true);
        expect(allowed("@lucide/svelte")).toBe(true);
        expect(allowed("#/components/ui/select")).toBe(true);
    });

    it.each(slugs)("%s shows its entry first in the code panel", (slug) => {
        const { files } = collectFiles(APP, slug);
        expect(files[0]).toBe(`${slug}/index.svelte`);
        expect(examples.find((e) => e.slug === slug)?.files).toEqual(files);
    });

    it.each(slugs)("%s assembles the flow itself: <Flow.Root>", (slug) => {
        const source = readFileSync(
            join(EXAMPLES_DIR, slug, "index.svelte"),
            "utf-8",
        );
        expect(markupOf(source)).toMatch(/<Flow\.Root\b/);
    });

    it.each(slugs)("%s keeps class strings out of its templates", (slug) => {
        expect(
            statSync(join(EXAMPLES_DIR, slug, "styles.ts"), {
                throwIfNoEntry: false,
            })?.isFile(),
        ).toBe(true);
        for (const file of walk(join(EXAMPLES_DIR, slug))) {
            if (!file.endsWith(".svelte")) continue;
            // looks go in styles.ts and are bound (`class={styles.part}`)
            expect(
                inlineClasses(markupOf(readFileSync(file, "utf-8"))),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });

    it("finds inline classes the styles.ts rule forbids", () => {
        expect(inlineClasses('<div class="flex" />')).toHaveLength(1);
        expect(inlineClasses("<div class={cn(a, b)} />")).toHaveLength(1);
        expect(
            inlineClasses(`<div class={on ? "a" : styles.b} />`),
        ).toHaveLength(1);
        expect(inlineClasses("<div class:active={on} />")).toHaveLength(1);
        expect(
            inlineClasses(
                "<div class={styles.cell} /><p class={styles.dot(tone)} />",
            ),
        ).toEqual([]);
        expect(
            markupOf(
                '<script lang="ts">const a = cn("x");</script>\n<div class={styles.a} />',
            ),
        ).toBe("\n<div class={styles.a} />");
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!/\.(ts|svelte)$/.test(file)) continue;
            expect(
                readFileSync(file, "utf-8"),
                relative(EXAMPLES_DIR, file),
            ).not.toMatch(/\.adapter\b/);
        }
    });
});

describe("the Svelte kit", () => {
    it("renders no Flow primitive: the examples assemble the flow", () => {
        for (const file of walk(KIT)) {
            expect(
                importsOf(readFileSync(file, "utf-8")).filter((specifier) =>
                    specifier.startsWith("@fragiola/flow-svelte"),
                ),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });

    it("holds no styles: classes live in each example's styles.ts", () => {
        for (const file of walk(KIT)) {
            if (!file.endsWith(".svelte")) continue;
            expect(
                inlineClasses(markupOf(readFileSync(file, "utf-8"))),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });
});
