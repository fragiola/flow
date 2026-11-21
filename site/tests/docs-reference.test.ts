// From Splitter (fragiola/splitter, site/tests/docs-reference.test.ts), itself from Dockable; same
// author and licence, rewritten for Flow's packages.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The API reference is written by hand, and this test keeps it honest.
//
// Why by hand: Fumadocs generates prop tables with fumadocs-typescript (`AutoTypeTable`), which
// drives the TypeScript compiler API. This repo pins TypeScript 7, the native compiler, which
// ships no JavaScript compiler API, so the tables live in site/docs/api/**/*.mdx and the checks
// below fail when the sources and the pages drift apart:
//
// - every export of @fragiola/flow-react (index.ts, the parts of parts.ts, and the primitives of
//   its feature entries `/minimap` and `/resize`) is on its reference page, every part has its own
//   page titled by its name, and every field of every exported props, state, options or result
//   interface is a row of its page's tables (following `extends` into the packages' interfaces);
// - the core pages mention every export of the core and of each feature entry, list every key of
//   the model's and the engine's verbs and every engine event, and have a row for every member of
//   the model, the engine and its adapter, every error code, every field of the document, the
//   command bus types, the engine's payloads and reads, the features' options and the path
//   helpers' options; every command of the registry has its section on the generated page.
//
// Interfaces are read with regular expressions (fields are the 4-space-indented `name?:` lines of
// an `export interface … {` block), which is enough for this codebase's formatting (Biome).

const ROOT = join(import.meta.dirname, "../..");
const REACT_SRC = join(ROOT, "packages/react/src");
const VUE_SRC = join(ROOT, "packages/vue/src");
const SVELTE_SRC = join(ROOT, "packages/svelte/src");
const CORE_SRC = join(ROOT, "packages/core/src");
const API = join(import.meta.dirname, "../docs/api");

const read = (path: string) => readFileSync(path, "utf-8");
/** The MDX of an API page: `model`, `primitives/root`. */
const page = (slug: string) => read(join(API, `${slug}.mdx`));

/** The core's features, each one its own entry (`@fragiola/flow/<feature>`). */
const FEATURES = [
    "selection",
    "subflows",
    "drag",
    "resize",
    "connection",
    "reconnection",
    "keyboard",
    "minimap",
] as const;

/** What the test reads of a command in the core's registry. */
interface CommandInfo {
    name: string;
}

// the core and its features, loaded at run time from their sources: a computed path keeps the
// site's typecheck from checking the core too (it has its own)
const core = (await import(join(CORE_SRC, "index.ts"))) as {
    createFlowModel(
        json?: unknown,
        options?: { features?: readonly unknown[] },
    ): { get(key: "commands"): readonly CommandInfo[] };
};
const factories = await Promise.all(
    FEATURES.map(async (name) => {
        const entry = (await import(
            join(CORE_SRC, name, "index.ts")
        )) as Record<string, unknown>;
        return entry[name] as () => unknown;
    }),
);

/** The reference page of each module the React package's main entry exports from. */
const MODULE_PAGES: Record<string, string> = {
    "./components/background": "primitives/background",
    "./components/connection-line": "primitives/connection-line",
    "./components/controls": "primitives/controls",
    "./components/edge": "primitives/edge",
    "./components/edge-label": "primitives/edge-label",
    "./components/edge-path": "primitives/edge-path",
    "./components/edges": "primitives/edges",
    "./components/fit-view": "primitives/fit-view",
    "./components/handle": "primitives/handle",
    "./components/node": "primitives/node",
    "./components/node-toolbar": "primitives/node-toolbar",
    "./components/nodes": "primitives/nodes",
    "./components/reconnect-anchor": "primitives/reconnect-anchor",
    "./components/root": "primitives/root",
    "./components/selection-box": "primitives/selection-box",
    "./components/toggle-interactive": "primitives/toggle-interactive",
    "./components/viewport": "primitives/viewport",
    "./components/zoom-in": "primitives/zoom-in",
    "./components/zoom-out": "primitives/zoom-out",
    "./hooks/create-flow-ref": "primitives/flow-ref",
    "./hooks/use-connection": "primitives/hooks",
    "./hooks/use-control-button": "primitives/controls",
    "./hooks/use-edge": "primitives/hooks",
    "./hooks/use-edges": "primitives/hooks",
    "./hooks/use-flow": "primitives/hooks",
    "./hooks/use-flow-ref": "primitives/flow-ref",
    "./hooks/use-handle": "primitives/hooks",
    "./hooks/use-node": "primitives/hooks",
    "./hooks/use-nodes": "primitives/hooks",
    "./hooks/use-selection": "primitives/hooks",
    "./hooks/use-viewport": "primitives/hooks",
    "./utils/use-render": "primitives/root",
};

/** The React feature entries with primitives of their own: each module's page, by entry. */
const FEATURE_MODULE_PAGES: Record<string, Record<string, string>> = {
    minimap: {
        "./mini-map": "primitives/mini-map",
        "./mini-map-node": "primitives/mini-map-node",
        "./mini-map-mask": "primitives/mini-map-mask",
    },
    resize: {
        "./node-resizer": "primitives/node-resizer",
        "./resize-handle": "primitives/resize-handle",
    },
};

interface Export {
    name: string;
    module: string;
}

/** `export { a, type B } from "./x"` and `export type { … } from "./x"` statements. */
function namedExports(source: string): Export[] {
    const exports: Export[] = [];
    for (const match of source.matchAll(
        /export (?:type )?\{([^}]*)\} from "([^"]+)"/g,
    )) {
        const [, names = "", module = ""] = match;
        for (const raw of names.split(",")) {
            const name = raw
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)
                .pop();
            if (name) exports.push({ name, module });
        }
    }
    return exports;
}

/**
 * The fields of `export interface <name> … { … }` (or of `export type <name> … = { … }`) in
 * `source`, or undefined when absent. `extendsNames` are the names in its heritage clause.
 */
function interfaceFields(
    source: string,
    name: string,
): { fields: string[]; extendsNames: string[] } | undefined {
    // an empty body (`… extends PrimitiveProps {}`) first: the other pattern would run on past it
    const declared =
        new RegExp(`export interface ${name}\\b([^{]*)\\{()\\}`).exec(source) ??
        new RegExp(
            `export interface ${name}\\b([^{]*)\\{([\\s\\S]*?)\\n\\}`,
        ).exec(source);
    const aliased = new RegExp(
        `export type ${name}\\b(?:<[^>]*>)?\\s*= \\{([\\s\\S]*?)\\n\\}`,
    ).exec(source);
    if (!declared && !aliased) return undefined;
    const heritage = declared?.[1] ?? "";
    const body = (declared ? declared[2] : aliased?.[1]) ?? "";
    const fields = [...body.matchAll(/^ {4}(?:readonly )?(\w+)\??:/gm)].map(
        (field) => field[1] ?? "",
    );
    // the bases after `extends`: not the type parameters (`<T extends …>`), not type arguments
    let bases = heritage;
    while (/<[^<>]*>/.test(bases)) bases = bases.replace(/<[^<>]*>/g, "");
    bases = bases.replace(/^\s*extends\b/, "");
    const extendsNames = [...bases.matchAll(/\b([A-Z]\w*)\b/g)].map(
        (base) => base[1] ?? "",
    );
    return { fields, extendsNames };
}

/** Every `.ts`/`.tsx` file under `dir`. */
function sourceFiles(dir: string): string[] {
    return readdirSync(dir, { recursive: true, encoding: "utf-8" })
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => join(dir, file));
}

const REACT_FILES = sourceFiles(REACT_SRC).map(read);
const CORE_FILES = sourceFiles(CORE_SRC).map(read);

const VUE_FILES = sourceFiles(VUE_SRC).map(read);

/**
 * A Svelte component's `<script module lang="ts">`, where its props and state types are declared,
 * dedented by its 4 spaces so the interface patterns above read it as a `.ts` file.
 */
function scriptModule(source: string): string {
    const body =
        /<script module lang="ts">\n([\s\S]*?)<\/script>/.exec(source)?.[1] ??
        "";
    return body.replace(/^ {4}/gm, "");
}

/** Every `.svelte` file under `dir`. */
function svelteFiles(dir: string): string[] {
    return readdirSync(dir, { recursive: true, encoding: "utf-8" })
        .filter((file) => file.endsWith(".svelte"))
        .map((file) => join(dir, file));
}

// the Svelte package's `.ts` and `.svelte.ts` files, and its components' module scripts
const SVELTE_FILES = [
    ...sourceFiles(SVELTE_SRC).map(read),
    ...svelteFiles(SVELTE_SRC).map((file) => scriptModule(read(file))),
];

/**
 * Fields of an interface, following `extends` into the interfaces the packages declare (`files`:
 * React's and the core's by default).
 */
function allFields(
    source: string,
    name: string,
    files: readonly string[] = [...REACT_FILES, ...CORE_FILES],
): string[] {
    const found = interfaceFields(source, name);
    if (!found) return [];
    const inherited = found.extendsNames.flatMap((base) => {
        const declaring = files.find((file) => interfaceFields(file, base));
        return declaring ? allFields(declaring, base, files) : [];
    });
    return [...found.fields, ...inherited];
}

/** The names in the first cell of every markdown table row: `` | `a`, `b(…)` | `` gives a and b. */
function tableRowNames(mdx: string): Set<string> {
    const names = new Set<string>();
    for (const match of mdx.matchAll(/^\|([^|\n]*)\|/gm)) {
        for (const code of (match[1] ?? "").matchAll(/`([^`]+)`/g)) {
            const cell = (code[1] ?? "").replace(/^"|"$/g, "");
            names.add(cell.split(/[(<\s?]/)[0] ?? cell);
        }
    }
    return names;
}

/** `name` appears in the page as code: `` `name` ``, `` `name<…>` ``, `` `name(…)` ``, `` `name.x` ``. */
function mentions(mdx: string, name: string): boolean {
    return new RegExp(`\`${name}[\`<(.]`).test(mdx);
}

/** `key` appears in the page as a quoted key in code: `` `"node-by"` ``. */
function mentionsKey(mdx: string, key: string): boolean {
    return mdx.includes(`\`"${key}"\``);
}

/** The keys of the registry `export interface <name> { … }`: `viewport`, `"edge-path-by"`, … */
function registryKeys(source: string, name: string): string[] {
    const body =
        new RegExp(
            `export interface ${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`,
        ).exec(source)?.[1] ?? "";
    return [...body.matchAll(/^ {4}"?([\w-]+)"?:/gm)].map(
        (match) => match[1] ?? "",
    );
}

/** The members of `export interface <name> … { … }`: fields and methods. */
function members(source: string, name: string): string[] {
    const start = source.indexOf(`export interface ${name}`);
    expect(start, `export interface ${name}`).toBeGreaterThanOrEqual(0);
    const body = source.slice(start, source.indexOf("\n}\n", start));
    return [
        ...new Set(
            [...body.matchAll(/^ {4}(?:readonly )?(\w+)[<(:?]/gm)].map(
                (match) => match[1] ?? "",
            ),
        ),
    ];
}

/** Expects a row on `slug` for every field of each interface of `names` in `file` (core). */
function expectRows(
    slug: string,
    file: string,
    names: readonly string[],
): number {
    const source = read(join(CORE_SRC, file));
    const rows = tableRowNames(page(slug));
    let checked = 0;
    for (const name of names) {
        const fields = interfaceFields(source, name)?.fields ?? [];
        expect(fields.length, `${name} in ${file}`).toBeGreaterThan(0);
        for (const field of fields) {
            checked++;
            expect(rows.has(field), `${name}.${field} on api/${slug}.mdx`).toBe(
                true,
            );
        }
    }
    return checked;
}

/** The part of a page under `## <heading>`, up to the next `##` heading. */
function sectionOf(mdx: string, heading: string): string {
    const start = mdx.search(new RegExp(`^## ${heading}$`, "m"));
    expect(start, `## ${heading}`).toBeGreaterThanOrEqual(0);
    const rest = mdx.slice(start + heading.length + 3);
    const end = rest.search(/^## /m);
    return end === -1 ? rest : rest.slice(0, end);
}

/**
 * The fields of a primitive's state, wherever it is declared: `<Name>State` in any module (a
 * node's is its hook's, `NodeState`), the control buttons' shared `ControlButtonState`.
 */
function stateFields(name: string): string[] {
    const interfaceName = ["Controls", "ZoomIn", "ZoomOut", "FitView"].includes(
        name,
    )
        ? "ControlButtonState"
        : `${name}State`;
    const declaring = REACT_FILES.find((file) =>
        interfaceFields(file, interfaceName),
    );
    return declaring ? allFields(declaring, interfaceName) : [];
}

const index = read(join(REACT_SRC, "index.ts"));
const parts = read(join(REACT_SRC, "parts.ts"));
const indexExports = namedExports(index);
const partExports = namedExports(parts);

/** The source of a module of `dir` (the React `src` by default). */
function sourceOf(module: string, dir = REACT_SRC): string {
    const base = join(dir, module.replace(/^\.\//, ""));
    try {
        return read(`${base}.tsx`);
    } catch {
        return read(`${base}.ts`);
    }
}

/** Every primitive: its name, its page and its module's source. */
const primitives = [
    ...partExports.map(({ name, module }) => ({
        name,
        slug: MODULE_PAGES[module] ?? "",
        source: sourceOf(module),
        namespaced: true,
    })),
    ...Object.entries(FEATURE_MODULE_PAGES).flatMap(([entry, pages]) =>
        namedExports(read(join(REACT_SRC, entry, "index.ts")))
            .filter(
                ({ name, module }) =>
                    /^[A-Z]/.test(name) &&
                    !/(Props|State|Position|POSITIONS)$/.test(name) &&
                    module in pages,
            )
            .map(({ name, module }) => ({
                name,
                slug: pages[module] ?? "",
                source: sourceOf(module, join(REACT_SRC, entry)),
                namespaced: false,
            })),
    ),
];

describe("the React reference", () => {
    it("has a page for every module the package exports from", () => {
        const modules = new Set(indexExports.map((entry) => entry.module));
        for (const module of modules) {
            expect(
                MODULE_PAGES,
                `no reference page for ${module}`,
            ).toHaveProperty(module);
        }
        for (const [entry, pages] of Object.entries(FEATURE_MODULE_PAGES)) {
            const source = read(join(REACT_SRC, entry, "index.ts"));
            for (const { module } of namedExports(source)) {
                expect(pages, `no page for ${entry}/${module}`).toHaveProperty(
                    module,
                );
            }
        }
    });

    it("re-exports the core and exports the Flow namespace from parts.ts", () => {
        expect(index).toMatch(/^export \* from "@fragiola\/flow";$/m);
        expect(index).toMatch(/export \* as Flow from "\.\/parts"/);
    });

    it("documents every primitive on its own page, titled by its name alone", () => {
        expect(primitives.map((part) => part.name).sort()).toEqual(
            [
                "Background",
                "ConnectionLine",
                "Controls",
                "Edge",
                "EdgeLabel",
                "EdgePath",
                "Edges",
                "FitView",
                "Handle",
                "MiniMap",
                "MiniMapMask",
                "MiniMapNode",
                "Node",
                "NodeResizer",
                "NodeToolbar",
                "Nodes",
                "ReconnectAnchor",
                "ResizeHandle",
                "Root",
                "SelectionBox",
                "ToggleInteractive",
                "Viewport",
                "ZoomIn",
                "ZoomOut",
            ].sort(),
        );
        for (const { name, slug, namespaced } of primitives) {
            const mdx = page(slug);
            // the title never repeats the project's name: www appends it (CONTRACT §3.6)
            expect(mdx, `api/${slug}.mdx`).toMatch(
                new RegExp(`^title: ${name}$`, "m"),
            );
            expect(mdx, `api/${slug}.mdx`).toContain(
                namespaced ? `\`Flow.${name}\`` : `\`${name}\``,
            );
        }
    });

    it("mentions every named export on its module's page", () => {
        for (const { name, module } of indexExports) {
            const slug = MODULE_PAGES[module] ?? "";
            expect(
                mentions(page(slug), name),
                `${name} on api/${slug}.mdx`,
            ).toBe(true);
        }
        for (const [entry, pages] of Object.entries(FEATURE_MODULE_PAGES)) {
            const source = read(join(REACT_SRC, entry, "index.ts"));
            for (const { name, module } of namedExports(source)) {
                const slug = pages[module] ?? "";
                expect(
                    mentions(page(slug), name),
                    `${name} on api/${slug}.mdx`,
                ).toBe(true);
            }
        }
    });

    it("has a table row for every field of every exported interface", () => {
        let checked = 0;
        const entries = [
            ...indexExports.map(({ name, module }) => ({
                name,
                source: sourceOf(module),
                slug: MODULE_PAGES[module] ?? "",
            })),
            ...Object.entries(FEATURE_MODULE_PAGES).flatMap(([entry, pages]) =>
                namedExports(read(join(REACT_SRC, entry, "index.ts"))).map(
                    ({ name, module }) => ({
                        name,
                        source: sourceOf(module, join(REACT_SRC, entry)),
                        slug: pages[module] ?? "",
                    }),
                ),
            ),
        ];
        for (const { name, source, slug } of entries) {
            const rows = tableRowNames(page(slug));
            for (const field of allFields(source, name)) {
                checked++;
                expect(
                    rows.has(field),
                    `${name}.${field} has no row on api/${slug}.mdx`,
                ).toBe(true);
            }
        }
        // the parser found the interfaces (a formatting change must not silently pass)
        expect(checked).toBeGreaterThan(140);
    });

    it("has a row for every prop and every state field of every primitive, and no other", () => {
        // the root's engine props are a Pick of the engine's options: each one is a prop too
        const root = read(join(REACT_SRC, "components/root.tsx"));
        const picked =
            /export type RootEngineProps = Pick<[\s\S]*?,([\s\S]*?)>;/.exec(
                root,
            )?.[1] ?? "";
        const engineProps = [...picked.matchAll(/"(\w+)"/g)].map(
            (m) => m[1] ?? "",
        );
        expect(engineProps.length).toBeGreaterThan(10);
        let states = 0;
        for (const { name, slug, source } of primitives) {
            expect(source, `${name}Props`).toMatch(
                new RegExp(`export interface ${name}Props\\b`),
            );
            const mdx = page(slug);
            const props = [
                ...allFields(source, `${name}Props`),
                ...(name === "Root" ? engineProps : []),
            ];
            const state = stateFields(name);
            if (state.length > 0) states++;
            for (const [section, fields] of [
                ["Props", props],
                ["State", state],
            ] as const) {
                const rows = tableRowNames(sectionOf(mdx, section));
                for (const field of fields) {
                    expect(
                        rows.has(field),
                        `${name}: ${field} under ## ${section} of api/${slug}.mdx`,
                    ).toBe(true);
                }
                // a row of a prop or field that no longer exists fails too
                for (const row of rows) {
                    expect(
                        fields,
                        `${name}: ## ${section} of api/${slug}.mdx has a row for ${row}`,
                    ).toContain(row);
                }
            }
        }
        // every primitive shows a state (a lookup that finds nothing must not pass silently)
        expect(states).toBe(primitives.length);
    });

    it("documents the common props on the root page, linked from every primitive", () => {
        const common = allFields(
            read(join(REACT_SRC, "utils/use-render.ts")),
            "PrimitiveProps",
        );
        expect(common).toEqual(["render", "className", "style", "ref"]);
        const rows = tableRowNames(page("primitives/root"));
        for (const field of common) expect(rows.has(field), field).toBe(true);
        expect(page("primitives/root")).toMatch(/^## Common props$/m);
        for (const { slug } of primitives) {
            if (slug === "primitives/root") continue;
            expect(page(slug), `api/${slug}.mdx`).toContain(
                "/docs/api/primitives/root#common-props",
            );
        }
    });

    it("gives every primitive page its part attribute", () => {
        for (const { slug } of primitives) {
            expect(page(slug), `api/${slug}.mdx`).toContain("`data-flow-part`");
        }
    });
});

/**
 * The pages with React code, which show it in Vue and in Svelte too (`<Framework name="vue">`,
 * `<Framework name="svelte">`). Every page whose snippets use the React API belongs here.
 */
const PAGES_IN_EVERY_FRAMEWORK = [
    "index",
    "getting-started/introduction",
    "getting-started/installation",
    "getting-started/first-flow",
    "getting-started/sizing",
    "getting-started/accessible-names",
    "concepts/composition",
    "concepts/features",
    "concepts/handles-and-connections",
    "concepts/model-and-commands",
    "concepts/model-and-engine",
    "concepts/nodes-and-edges",
    "concepts/primitive-contract",
    "concepts/state-attributes",
    "concepts/typed-data",
    "concepts/viewport",
    "api/primitives/hooks",
    "api/primitives/flow-ref",
    "api/command-bus",
    "api/engine",
    "api/features",
    "api/json-document",
    "api/model",
    "api/path-helpers",
    "guides/ai-and-automation",
    "guides/connection-rules",
    "guides/custom-edges",
    "guides/custom-nodes",
    "guides/keyboard",
    "guides/minimap-and-controls",
    "guides/persistence",
    "guides/resizing",
    "guides/selection",
    "guides/styling-css",
    "guides/styling-tailwind",
    "guides/sub-flows",
    "guides/testing",
    "guides/theming",
    "guides/undo-redo",
];

/** Every page of the docs, as its slug (`guides/selection`). */
function allPages(dir = join(API, ".."), prefix = ""): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
            ? allPages(join(dir, entry.name), `${prefix}${entry.name}/`)
            : entry.name.endsWith(".mdx")
              ? [`${prefix}${entry.name.slice(0, -".mdx".length)}`]
              : [],
    );
}

/** A page's text outside its `<Framework>` blocks. */
const outsideFrameworks = (mdx: string) =>
    mdx.replace(/<Framework name="[a-z]+">[\s\S]*?<\/Framework>/g, "");

describe("the Vue reference", () => {
    const vueIndex = read(join(VUE_SRC, "index.ts"));
    const vueParts = namedExports(read(join(VUE_SRC, "parts.ts")));
    const vuePage = page("primitives/vue");
    const VUE_FEATURE_ENTRIES = ["minimap", "resize"] as const;
    /** Every part of the Vue package: its name, its source and its React page. */
    const vuePrimitives = [
        ...vueParts.map(({ name, module }) => ({
            name,
            source: read(join(VUE_SRC, `${module.replace(/^\.\//, "")}.ts`)),
        })),
        ...VUE_FEATURE_ENTRIES.flatMap((entry) =>
            namedExports(read(join(VUE_SRC, entry, "index.ts")))
                .filter(({ name }) =>
                    primitives.some(
                        (part) => !part.namespaced && part.name === name,
                    ),
                )
                .map(({ name, module }) => ({
                    name,
                    source: read(
                        join(
                            VUE_SRC,
                            entry,
                            `${module.replace(/^\.\//, "")}.ts`,
                        ),
                    ),
                })),
        ),
    ].map((part) => ({
        ...part,
        slug: primitives.find((react) => react.name === part.name)?.slug ?? "",
    }));

    it("re-exports the core and exports the same Flow namespace as React", () => {
        expect(vueIndex).toMatch(/^export \* from "@fragiola\/flow";$/m);
        expect(vueIndex).toMatch(/export \* as Flow from "\.\/parts"/);
        expect(vueParts.map((entry) => entry.name)).toEqual(
            partExports.map((entry) => entry.name),
        );
        // every React primitive, the features' included, is a Vue one with the same page
        expect(vuePrimitives.map((part) => part.name).sort()).toEqual(
            primitives.map((part) => part.name).sort(),
        );
    });

    it("mentions every named export of the Vue package and its /minimap and /resize entries on api/primitives/vue.mdx", () => {
        const exports = [
            ...namedExports(vueIndex),
            ...VUE_FEATURE_ENTRIES.flatMap((entry) =>
                namedExports(read(join(VUE_SRC, entry, "index.ts"))),
            ),
        ];
        expect(exports.length).toBeGreaterThan(100);
        for (const { name } of exports) {
            expect(
                mentions(vuePage, name),
                `${name} on api/primitives/vue.mdx`,
            ).toBe(true);
        }
    });

    it("has a row for every prop of every part: on api/primitives/vue.mdx, or on the part's React page", () => {
        const vueRows = tableRowNames(vuePage);
        let checked = 0;
        for (const { name, source, slug } of vuePrimitives) {
            const fields = allFields(source, `${name}Props`, [
                ...VUE_FILES,
                ...CORE_FILES,
            ]);
            expect(fields, `${name}Props`).toContain("as");
            const rows = new Set([...vueRows, ...tableRowNames(page(slug))]);
            for (const field of fields) {
                checked++;
                expect(rows.has(field), `Vue ${name}.${field}`).toBe(true);
            }
        }
        expect(checked).toBeGreaterThan(40);
    });

    it("documents every slot, the root's events and what the render slot receives", () => {
        const rows = tableRowNames(vuePage);
        const render = read(join(VUE_SRC, "utils/render.ts"));
        const renderFields = [
            ...allFields(render, "RenderSlot", VUE_FILES),
            ...allFields(render, "RenderSlotProps", VUE_FILES),
        ];
        expect(renderFields).toEqual(["render", "props", "state", "children"]);
        for (const field of renderFields)
            expect(rows.has(field), field).toBe(true);
        expect(rows.has("default")).toBe(true);
        const root = read(join(VUE_SRC, "components/root.ts"));
        const events = [
            ...(
                /export type RootEmits[\s\S]*?\n\};/.exec(root)?.[0] ?? ""
            ).matchAll(/^ {4}"update:(\w+)":/gm),
        ].map((match) => match[1] ?? "");
        expect(events).toEqual(["nodes", "edges", "viewport"]);
        for (const event of events) {
            expect(rows.has(`v-model:${event}`), `v-model:${event}`).toBe(true);
        }
    });

    it("is in the sidebar, and the pages with React code show it in Vue too", () => {
        expect(read(join(API, "../config.json"))).toContain(
            '"path": "api/primitives/vue"',
        );
        for (const slug of [
            ...PAGES_IN_EVERY_FRAMEWORK,
            ...primitives.map((part) => `api/${part.slug}`),
        ]) {
            const mdx = read(join(API, "..", `${slug}.mdx`));
            expect(mdx, slug).toContain('<Framework name="vue">');
            // a Vue block wherever there is a React one
            expect(mdx.split('<Framework name="vue">').length, slug).toBe(
                mdx.split('<Framework name="react">').length,
            );
        }
    });

    it("leaves no React code outside a React block: JSX, or an import of the React package", () => {
        const listed = new Set(PAGES_IN_EVERY_FRAMEWORK);
        for (const slug of allPages()) {
            const outside = outsideFrameworks(
                read(join(API, "..", `${slug}.mdx`)),
            );
            const fences = [
                ...outside.matchAll(/^```(\w+)[^\n]*\n([\s\S]*?)^```/gm),
            ];
            for (const [, lang, code] of fences) {
                expect(
                    lang,
                    `${slug}: a ${lang} snippet outside a block`,
                ).not.toBe("tsx");
                expect(
                    code,
                    `${slug}: React's package outside a block`,
                ).not.toMatch(/@fragiola\/flow-react|from "react"/);
            }
            if (
                outside !== read(join(API, "..", `${slug}.mdx`)) &&
                !slug.startsWith("api/primitives/")
            ) {
                expect(
                    listed.has(slug),
                    `${slug} has blocks: list it in PAGES_IN_EVERY_FRAMEWORK`,
                ).toBe(true);
            }
        }
    });
});

describe("the Svelte reference", () => {
    const svelteIndex = read(join(SVELTE_SRC, "index.ts"));
    const svelteParts = namedExports(read(join(SVELTE_SRC, "parts.ts")));
    const sveltePage = page("primitives/svelte");
    const SVELTE_FEATURE_ENTRIES = ["minimap", "resize"] as const;
    /** A component's module script, from its module specifier (`./components/root.svelte`). */
    const componentModule = (dir: string, module: string) =>
        scriptModule(read(join(dir, module.replace(/^\.\//, ""))));
    /** Every part of the Svelte package: its name, its module script and its React page. */
    const sveltePrimitives = [
        ...svelteParts.map(({ name, module }) => ({
            name,
            source: componentModule(SVELTE_SRC, module),
        })),
        ...SVELTE_FEATURE_ENTRIES.flatMap((entry) =>
            namedExports(read(join(SVELTE_SRC, entry, "index.ts")))
                .filter(({ name }) =>
                    primitives.some(
                        (part) => !part.namespaced && part.name === name,
                    ),
                )
                .map(({ name, module }) => ({
                    name,
                    source: componentModule(join(SVELTE_SRC, entry), module),
                })),
        ),
    ].map((part) => ({
        ...part,
        slug: primitives.find((react) => react.name === part.name)?.slug ?? "",
    }));
    const render = read(join(SVELTE_SRC, "utils/render.ts"));
    /** What every part's props extend (`render`, `class`, `style`, `ref`). */
    const primitiveFields = allFields(render, "PrimitiveProps", SVELTE_FILES);

    /**
     * The keys of `export type <name> = Pick<…, | "a" | "b">` in the Svelte files (the root's
     * engine props), which the interface patterns do not read.
     */
    function pickedKeys(name: string): string[] {
        for (const file of SVELTE_FILES) {
            const picked = new RegExp(
                `export type ${name} = Pick<[^,]+,([^>]*)>`,
            ).exec(file);
            if (picked) {
                return [...(picked[1] ?? "").matchAll(/"(\w+)"/g)].map(
                    (key) => key[1] ?? "",
                );
            }
        }
        return [];
    }

    /** Every prop of a part: its own, its interfaces', its picked engine options and the primitive's. */
    function propsOf(name: string, source: string): string[] {
        const declared = interfaceFields(source, `${name}Props`);
        expect(declared, `${name}Props`).toBeDefined();
        // its element's props (`DivPrimitiveProps`, `SvgPrimitiveProps`, …) are the primitive's
        expect(source, `${name}Props extends a primitive's props`).toMatch(
            new RegExp(
                `export interface ${name}Props\\b[^{]*\\b(?:Div|Button|Svg)PrimitiveProps<`,
            ),
        );
        return [
            ...allFields(source, `${name}Props`, [
                ...SVELTE_FILES,
                ...CORE_FILES,
            ]),
            ...(declared?.extendsNames ?? []).flatMap(pickedKeys),
            ...primitiveFields,
        ];
    }

    it("re-exports the core and exports the same Flow namespace as React", () => {
        expect(svelteIndex).toMatch(/^export \* from "@fragiola\/flow";$/m);
        expect(svelteIndex).toMatch(/export \* as Flow from "\.\/parts\.js"/);
        expect(svelteParts.map((entry) => entry.name)).toEqual(
            partExports.map((entry) => entry.name),
        );
        // every React primitive, the features' included, is a Svelte one with the same page
        expect(sveltePrimitives.map((part) => part.name).sort()).toEqual(
            primitives.map((part) => part.name).sort(),
        );
    });

    it("mentions every named export of the Svelte package and its /minimap and /resize entries on api/primitives/svelte.mdx", () => {
        const exports = [
            ...namedExports(svelteIndex),
            ...SVELTE_FEATURE_ENTRIES.flatMap((entry) =>
                namedExports(read(join(SVELTE_SRC, entry, "index.ts"))),
            ),
        ];
        expect(exports.length).toBeGreaterThan(70);
        for (const { name } of exports) {
            expect(
                mentions(sveltePage, name),
                `${name} on api/primitives/svelte.mdx`,
            ).toBe(true);
        }
    });

    it("has a row for every prop of every part: on api/primitives/svelte.mdx, or on the part's React page", () => {
        expect(primitiveFields).toEqual(["render", "class", "style", "ref"]);
        // the engine options the root takes, read from its Pick
        expect(pickedKeys("RootEngineProps")).toContain("panOnScroll");
        const svelteRows = tableRowNames(sveltePage);
        let checked = 0;
        for (const { name, source, slug } of sveltePrimitives) {
            const rows = new Set([...svelteRows, ...tableRowNames(page(slug))]);
            for (const field of propsOf(name, source)) {
                checked++;
                expect(rows.has(field), `Svelte ${name}.${field}`).toBe(true);
            }
        }
        expect(checked).toBeGreaterThan(150);
    });

    it("documents Svelte's own props on its page: the primitive's, the callbacks, the bindings and the render snippet's fields", () => {
        const rows = tableRowNames(sveltePage);
        for (const field of primitiveFields) {
            expect(rows.has(field), field).toBe(true);
        }
        expect(rows.has("children")).toBe(true);
        const renderFields = allFields(
            render,
            "RenderSnippetProps",
            SVELTE_FILES,
        );
        expect(renderFields).toEqual(["props", "state", "children"]);
        for (const field of renderFields) {
            expect(rows.has(field), field).toBe(true);
        }
        // the root's callbacks are lowercase, not React's: they need their own rows
        const root = sveltePrimitives.find((part) => part.name === "Root");
        const callbacks = propsOf("Root", root?.source ?? "").filter((field) =>
            /^on[a-z]+$/.test(field),
        );
        expect(callbacks).toEqual([
            "onnodeschange",
            "onedgeschange",
            "onviewportchange",
        ]);
        for (const callback of callbacks) {
            expect(rows.has(callback), callback).toBe(true);
        }
        // the bindable props, as `typedFlow` declares them (`Component<Props, Exports, Bindings>`)
        const typed = read(join(SVELTE_SRC, "typed.ts"));
        const bindings = new Set(
            [...typed.matchAll(/Record<string, never>,\s*([^>]+?)\s*>/g)]
                .flatMap((match) => [...(match[1] ?? "").matchAll(/"(\w+)"/g)])
                .map((match) => match[1] ?? ""),
        );
        expect([...bindings].sort()).toEqual([
            "edges",
            "nodes",
            "ref",
            "viewport",
        ]);
        for (const binding of bindings) {
            expect(rows.has(`bind:${binding}`), `bind:${binding}`).toBe(true);
        }
    });

    it("is in the sidebar, and the pages with React code show it in Svelte too", () => {
        expect(read(join(API, "../config.json"))).toContain(
            '"path": "api/primitives/svelte"',
        );
        for (const slug of [
            ...PAGES_IN_EVERY_FRAMEWORK,
            ...primitives.map((part) => `api/${part.slug}`),
        ]) {
            const mdx = read(join(API, "..", `${slug}.mdx`));
            expect(mdx, slug).toContain('<Framework name="svelte">');
            // a Svelte block wherever there is a React one
            expect(mdx.split('<Framework name="svelte">').length, slug).toBe(
                mdx.split('<Framework name="react">').length,
            );
        }
    });

    it("closes every block, and writes a framework's code in its block only (or on its own page)", () => {
        for (const slug of allPages()) {
            const mdx = read(join(API, "..", `${slug}.mdx`));
            expect(
                mdx.split("<Framework ").length,
                `${slug}: a <Framework> left open`,
            ).toBe(mdx.split("</Framework>").length);
            const fences = [
                ...outsideFrameworks(mdx).matchAll(
                    /^```(\w+)[^\n]*\n([\s\S]*?)^```/gm,
                ),
            ];
            for (const framework of ["vue", "svelte"]) {
                if (slug === `api/primitives/${framework}`) continue;
                for (const [, lang, code] of fences) {
                    expect(
                        lang,
                        `${slug}: a ${framework} snippet outside a block`,
                    ).not.toBe(framework);
                    expect(
                        code,
                        `${slug}: the ${framework} package outside a block`,
                    ).not.toContain(`@fragiola/flow-${framework}`);
                }
            }
        }
    });
});

describe("the core reference", () => {
    const commands = core
        .createFlowModel(undefined, {
            features: factories.map((factory) => factory()),
        })
        .get("commands");
    const apiPages = readdirSync(API, { recursive: true, encoding: "utf-8" })
        .filter((file) => file.endsWith(".mdx"))
        .map((file) => read(join(API, file)));
    const corePage = (name: string) =>
        apiPages.some((mdx) => mentions(mdx, name));

    it("has a section on the generated commands page for every command of the registry", () => {
        expect(commands.length).toBeGreaterThan(15);
        const commandsPage = page("commands");
        for (const info of commands) {
            expect(commandsPage, info.name).toContain(`### \`${info.name}\``);
        }
    });

    it("mentions every export of the core on an API page", () => {
        const source = read(join(CORE_SRC, "index.ts"));
        expect(source).not.toMatch(/export \* from/);
        const names = namedExports(source).map((entry) => entry.name);
        expect(names.length).toBeGreaterThan(150);
        const missing = names.filter((name) => !corePage(name));
        expect(missing, "exports no API page mentions").toEqual([]);
    });

    it("documents every feature entry: its exports and its options on the features page", () => {
        const mdx = page("features");
        const rows = tableRowNames(mdx);
        for (const feature of FEATURES) {
            const source = read(join(CORE_SRC, feature, "index.ts"));
            const exports = namedExports(source);
            expect(exports.length, feature).toBeGreaterThan(1);
            for (const { name } of exports) {
                expect(mentions(mdx, name), `${name} on api/features.mdx`).toBe(
                    true,
                );
            }
            expect(mdx, feature).toContain(`@fragiola/flow-react/${feature}`);
            const options = `${feature[0]?.toUpperCase()}${feature.slice(1)}Options`;
            for (const field of interfaceFields(
                read(join(CORE_SRC, feature, `${feature}.ts`)),
                options,
            )?.fields ?? []) {
                expect(rows.has(field), `${options}.${field}`).toBe(true);
            }
        }
    });

    it("lists every key of the model's get and is", () => {
        const source = read(join(CORE_SRC, "state/queries.ts"));
        const keys = [
            ...registryKeys(source, "ModelGetMap"),
            ...registryKeys(source, "ModelIsMap"),
        ];
        expect(keys.length).toBeGreaterThan(20);
        const mdx = page("model");
        for (const key of keys) {
            expect(mentionsKey(mdx, key), `"${key}" on api/model.mdx`).toBe(
                true,
            );
        }
    });

    it("documents every member of the model and its options", () => {
        const source = read(join(CORE_SRC, "model/create-flow-model.ts"));
        const found = members(source, "FlowModel<");
        expect(found.sort()).toEqual(
            [
                "can",
                "check",
                "dispatch",
                "get",
                "is",
                "run",
                "subscribe",
                "use",
            ].sort(),
        );
        const rows = tableRowNames(page("model") + page("command-bus"));
        for (const member of found) {
            expect(rows.has(member), `FlowModel.${member}`).toBe(true);
        }
        expectRows("model", "model/create-flow-model.ts", ["FlowModelOptions"]);
    });

    it("documents the command bus and every error code", () => {
        const source = read(join(CORE_SRC, "commands/types.ts"));
        const union =
            /export type CommandErrorCode =([^;]+);/.exec(source)?.[1] ?? "";
        const codes = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "");
        expect(codes.length).toBeGreaterThan(5);
        const rows = tableRowNames(page("command-bus"));
        for (const code of codes) {
            expect(rows.has(code), `error code ${code}`).toBe(true);
        }
        expectRows("command-bus", "commands/types.ts", [
            "CommandError",
            "RunOptions",
            "CommandEvent",
            "CommandInfo",
            "CommandContextBase",
            "BatchStep",
        ]);
    });

    it("has a table row for every field of the JSON document", () => {
        const checked =
            expectRows("json-document", "document/types.ts", [
                "FlowTypes",
                "NodeFlags",
                "EdgeFlags",
                "SelectionFields",
                "SubflowFields",
                "NodeFields",
                "EdgeFields",
                "NodeOf",
                "EdgeOf",
                "FlowJson",
            ]) +
            expectRows("json-document", "document/validate-flow.ts", [
                "ValidateFlowOptions",
            ]) +
            expectRows("json-document", "schema/types.ts", ["ValidationIssue"]);
        expect(checked).toBeGreaterThan(30);
    });

    it("documents every member of the engine and of its adapter, and its options", () => {
        const source = read(join(CORE_SRC, "engine/create-flow-engine.ts"));
        const engine = members(source, "FlowEngine<");
        expect(engine.sort()).toEqual(
            [
                "adapter",
                "can",
                "check",
                "destroy",
                "get",
                "is",
                "run",
                "subscribe",
            ].sort(),
        );
        const adapter = members(
            read(join(CORE_SRC, "engine/adapter.ts")),
            "FlowEngineAdapter",
        );
        expect(adapter.length).toBeGreaterThan(8);
        const rows = tableRowNames(page("engine"));
        for (const member of [...engine, ...adapter]) {
            expect(rows.has(member), `${member} on api/engine.mdx`).toBe(true);
        }
        expectRows("engine", "engine/create-flow-engine.ts", [
            "FlowEngineOptions",
        ]);
        expectRows("engine", "engine/adapter.ts", [
            "HandleRegistration",
            "FlowHandle",
            "ViewChange",
        ]);
    });

    it("has a row for every field of the engine's payloads and reads", () => {
        const checked = expectRows("engine", "engine/verbs.ts", [
            "FitViewPayload",
            "ZoomStepPayload",
            "BackgroundPatternPayload",
            "BackgroundPattern",
            "NodeToolbarPayload",
            "NodeToolbarPosition",
            "Connection",
            "MinimapView",
        ]);
        expect(checked).toBeGreaterThan(30);
    });

    it("lists every key of the engine's run, get and is, and every event", () => {
        const source = read(join(CORE_SRC, "engine/verbs.ts"));
        const keys = [
            ...registryKeys(source, "EngineActionMap"),
            ...registryKeys(source, "EngineGetMap"),
            ...registryKeys(source, "EngineIsMap"),
        ];
        expect(keys.length).toBeGreaterThan(30);
        const events = [
            ...read(join(CORE_SRC, "engine/events.ts")).matchAll(
                /readonly type: "([\w-]+)"/g,
            ),
        ].map((match) => match[1] ?? "");
        expect(events.length).toBeGreaterThan(10);
        const mdx = page("engine");
        for (const key of [...keys, ...events]) {
            expect(mentionsKey(mdx, key), `"${key}" on api/engine.mdx`).toBe(
                true,
            );
        }
    });

    it("documents the path helpers and their options", () => {
        const checked =
            expectRows("path-helpers", "geometry/types.ts", [
                "Rect",
                "Viewport",
                "PathEnds",
                "PathResult",
            ]) +
            expectRows("path-helpers", "geometry/bezier-path.ts", [
                "BezierPathOptions",
            ]) +
            expectRows("path-helpers", "geometry/smooth-step-path.ts", [
                "SmoothStepPathOptions",
                "StepPathOptions",
            ]) +
            expectRows("path-helpers", "geometry/straight-path.ts", [
                "StraightPathOptions",
            ]) +
            expectRows("path-helpers", "engine/edge-geometry.ts", [
                "PathOptions",
            ]);
        expect(checked).toBeGreaterThan(15);
        const mdx = page("path-helpers");
        for (const helper of [
            "bezierPath",
            "smoothStepPath",
            "stepPath",
            "straightPath",
        ]) {
            expect(mentions(mdx, helper), helper).toBe(true);
        }
    });
});
