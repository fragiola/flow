// From Splitter (fragiola/splitter, examples/shared/src/framework.ts), same author and licence.
// The frameworks an examples app can be written in. Each one is an app of its own,
// `examples/<framework>` (package `examples-<framework>`), built for `<base>/embed/<framework>/`;
// what they share (the metadata, the themes, the embed protocol, the manifest, the e2e specs) is
// this package. `site/project.json`'s `frameworks` says which ones the site export ships: all
// four (Vue, Svelte and Angular came with their adapter Epics).

export const FRAMEWORKS = ["react", "vue", "svelte", "angular"] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/** The file an example's folder is found by, and the code panel opens first. */
export const ENTRY_FILES: Record<Framework, string> = {
    react: "index.tsx",
    vue: "index.vue",
    svelte: "index.svelte",
    angular: "index.ts",
};

/** The adapter package an example of that framework installs (it brings the core). */
export const ADAPTER_PACKAGES: Record<Framework, string> = {
    react: "@fragiola/flow-react",
    vue: "@fragiola/flow-vue",
    svelte: "@fragiola/flow-svelte",
    angular: "@fragiola/flow-angular",
};

/**
 * The icon package an example imports itself (a consumer installs it): listed in the manifest's
 * `packages`, next to the adapter.
 */
export const ICON_PACKAGES: Record<Framework, string> = {
    react: "lucide-react",
    vue: "@lucide/vue",
    svelte: "@lucide/svelte",
    angular: "@lucide/angular",
};

/**
 * The npm packages, besides the icons, an example of any framework may import and its reader
 * installs: the layout engines of the layout examples (Epic #49). An example's manifest entry lists
 * the ones it imports, by package name (`elkjs` for `elkjs/lib/elk.bundled.js`).
 */
export const EXAMPLE_PACKAGES: readonly string[] = [
    "@dagrejs/dagre",
    "elkjs",
    "d3-force",
];

/** The package a bare import specifier names: `@scope/name` or `name`, without a subpath. */
export function packageOf(specifier: string): string {
    const parts = specifier.split("/");
    return (
        specifier.startsWith("@") ? parts.slice(0, 2) : parts.slice(0, 1)
    ).join("/");
}

export function isFramework(value: unknown): value is Framework {
    return FRAMEWORKS.includes(value as Framework);
}
