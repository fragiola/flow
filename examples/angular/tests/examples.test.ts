// examples/svelte/tests/examples.test.ts for the Angular app.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { PENDING } from "examples-shared/e2e/available";
import {
    collectFiles,
    type ExampleEntry,
    examplesApp,
    importsOf,
    listExampleSlugs,
    loadExamples,
} from "examples-shared/scripts/examples-lib";
import { beforeAll, describe, expect, it } from "vitest";

// The Angular side of the example contract: an example is standalone components in `.ts` files
// (`index.ts` its entry, default-exporting the example), `styles.ts` and plain TypeScript
// siblings, importing only what a consumer can copy: `@angular/core`, `@angular/common`, the
// Angular package and its feature entries, `@lucide/angular`, the Fragiola UI pieces
// (`#/components/…`, `#/lib/cn`) and relative files inside examples/. Every example assembles the
// flow itself, keeps the id it has in examples/react, and binds its classes from `styles.ts`. What
// every framework shares (the metadata) is checked in examples/shared/tests.

const APP = examplesApp("angular");
const EXAMPLES_DIR = APP.examplesDir;
const KIT = join(EXAMPLES_DIR, "_kit");

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^@angular\/(core|common)$/,
    // the Angular package re-exports the core and mirrors every feature's entry: an example never
    // imports @fragiola/flow
    /^@fragiola\/flow-angular(\/(selection|subflows|drag|resize|connection|reconnection|keyboard|minimap))?$/,
    /^@lucide\/angular$/,
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

/** The components' templates of a file: every `template: \`…\`` literal. */
function templatesOf(source: string): string {
    return [...source.matchAll(/\btemplate:\s*`([\s\S]*?)`/g)]
        .map((match) => match[1])
        .join("\n");
}

/**
 * Where a template styles itself instead of binding `styles.ts`: a `class="…"` or `class='…'`, a
 * string inside `[class]="…"`, a `[class.x]`, `[attr.class]`, `[className]` or `[ngClass]` binding
 * (a class from a part's state: the `data-*` style it), or a `cn()`.
 */
function inlineClasses(template: string): string[] {
    return [
        ...template.matchAll(
            /\sclass=("[^"]*"|'[^']*')|\[class\]="[^"]*['`][^"]*"|\[class\.[\w-]+\]|\[attr\.class\]|\[className\]|\[ngClass\]|\bcn\(/g,
        ),
    ].map((match) => match[0]);
}

/**
 * The classes a component's `host` sets itself: only `contents` is allowed, which takes the
 * component's own element out of the layout (the frame and the flow are its template's).
 */
function hostClasses(source: string): string[] {
    return [
        ...source.matchAll(/\bhost:\s*\{[^}]*?\bclass:\s*("[^"]*"|'[^']*')/g),
    ]
        .map((match) => (match[1] ?? "").slice(1, -1))
        .filter((value) => value !== "contents");
}

let examples: ExampleEntry[] = [];
beforeAll(async () => {
    examples = await loadExamples(APP);
});

describe("the Angular examples", () => {
    const slugs = listExampleSlugs(APP);

    it("are all in the manifest, each with a valid meta", () => {
        expect(examples.map((e) => e.slug).sort()).toEqual(slugs);
    });

    it("are every example of examples/react, with the same ids", () => {
        // Angular is a complete framework (examples/shared/e2e/available.ts): it ships every example
        expect(slugs.length).toBeGreaterThan(0);
        // but those a later Epic brings to it (`PENDING`)
        expect(slugs).toEqual(
            listExampleSlugs(examplesApp("react")).filter(
                (slug) => !PENDING.angular.includes(slug),
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

    it("refuses `@/`, the core, the other adapters and anything else a consumer lacks", () => {
        expect(allowed("@/lib/cn")).toBe(false);
        expect(allowed("@fragiola/flow")).toBe(false);
        expect(allowed("@fragiola/flow/drag")).toBe(false);
        expect(allowed("@fragiola/flow-react")).toBe(false);
        expect(allowed("@fragiola/flow-vue")).toBe(false);
        expect(allowed("@fragiola/flow-svelte")).toBe(false);
        expect(allowed("@fragiola/flow-angular/nope")).toBe(false);
        expect(allowed("lucide-react")).toBe(false);
        expect(allowed("@lucide/svelte")).toBe(false);
        expect(allowed("@angular/router")).toBe(false);
        expect(allowed("examples-shared/themes")).toBe(false);
        expect(allowed("@fragiola/flow-angular")).toBe(true);
        expect(allowed("@fragiola/flow-angular/minimap")).toBe(true);
        expect(allowed("@angular/core")).toBe(true);
        expect(allowed("@lucide/angular")).toBe(true);
        expect(allowed("#/components/ui/select")).toBe(true);
    });

    it.each(slugs)("%s shows its entry first in the code panel", (slug) => {
        const { files } = collectFiles(APP, slug);
        expect(files[0]).toBe(`${slug}/index.ts`);
        expect(examples.find((e) => e.slug === slug)?.files).toEqual(files);
    });

    it.each(slugs)("%s default-exports its component", (slug) => {
        const source = readFileSync(
            join(EXAMPLES_DIR, slug, "index.ts"),
            "utf-8",
        );
        expect(source).toMatch(/^export default class \w+/m);
    });

    it.each(slugs)("%s assembles the flow itself: flowRoot", (slug) => {
        const source = readFileSync(
            join(EXAMPLES_DIR, slug, "index.ts"),
            "utf-8",
        );
        expect(templatesOf(source)).toMatch(/\sflowRoot\b/);
    });

    it.each(slugs)("%s keeps class strings out of its templates", (slug) => {
        expect(
            statSync(join(EXAMPLES_DIR, slug, "styles.ts"), {
                throwIfNoEntry: false,
            })?.isFile(),
        ).toBe(true);
        for (const file of walk(join(EXAMPLES_DIR, slug))) {
            if (file.endsWith("styles.ts")) continue;
            const source = readFileSync(file, "utf-8");
            // looks go in styles.ts and are bound (`[class]="styles.part"`)
            expect(
                inlineClasses(templatesOf(source)),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
            expect(/\bcn\(/.test(source), relative(EXAMPLES_DIR, file)).toBe(
                false,
            );
            expect(hostClasses(source), relative(EXAMPLES_DIR, file)).toEqual(
                [],
            );
        }
    });

    it("finds inline classes the styles.ts rule forbids", () => {
        expect(inlineClasses('<div class="flex"></div>')).toHaveLength(1);
        expect(inlineClasses(`<div [class]="'flex'"></div>`)).toHaveLength(1);
        expect(
            inlineClasses(`<div [class]="on ? 'a' : styles.b"></div>`),
        ).toHaveLength(1);
        expect(
            inlineClasses(`<div [class.active]="n.state()?.selected"></div>`),
        ).toHaveLength(1);
        expect(inlineClasses("<div class='flex'></div>")).toHaveLength(1);
        expect(inlineClasses(`<div [attr.class]="x"></div>`)).toHaveLength(1);
        expect(inlineClasses(`<div [className]="x"></div>`)).toHaveLength(1);
        expect(hostClasses(`host: { class: "contents" }`)).toEqual([]);
        expect(
            hostClasses(`host: { "data-x": "", class: "flex gap-2" }`),
        ).toEqual(["flex gap-2"]);
        expect(inlineClasses(`<div [ngClass]="classes"></div>`)).toHaveLength(
            1,
        );
        expect(
            inlineClasses(
                `<div [class]="styles.cell"></div><p [class]="styles.dot(tone)"></p>`,
            ),
        ).toEqual([]);
        expect(
            templatesOf(
                'const a = 1;\n@Component({ template: `<div [class]="styles.a"></div>` })',
            ),
        ).toBe('<div [class]="styles.a"></div>');
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!file.endsWith(".ts")) continue;
            expect(
                readFileSync(file, "utf-8"),
                relative(EXAMPLES_DIR, file),
            ).not.toMatch(/\.adapter\b/);
        }
    });
});

describe("the Angular kit", () => {
    it("renders no Flow primitive: the examples assemble the flow", () => {
        for (const file of walk(KIT)) {
            expect(
                importsOf(readFileSync(file, "utf-8")).filter((specifier) =>
                    specifier.startsWith("@fragiola/flow-angular"),
                ),
                relative(EXAMPLES_DIR, file),
            ).toEqual([]);
        }
    });
});
