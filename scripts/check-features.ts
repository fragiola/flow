// The features' bundle guard (D2): a feature not imported is not in the app's bundle. Fails when
// the main entry of a package (its published `exports["."]` target in `dist`: `index.js`, or
// ng-packagr's `fesm2022/fragiola-flow-angular.mjs`), or a chunk it imports, holds a
// feature's code: a source its source map names under a feature's folder (`src/selection/`), or an
// import of a feature's entry point (`@fragiola/flow…/selection`). Run by `pnpm build`, after the
// packages built. From Tree (fragiola/tree, scripts/check-features.ts), same author and licence:
// it reads the source maps (not Data Grid's string markers), since the core names every feature's
// keys in `FEATURE_KEYS` (to refuse them when the feature is not installed). A package that is not
// bundled (the Svelte adapter: `@sveltejs/package` writes `dist/` file for file from `src/`, its
// `.svelte` components as they are) has no source maps: each built file is its own source
// (`dist/minimap/mini-map.svelte` is `src/minimap/mini-map.svelte`), and its imports are followed
// through the folders (`../utils/render.js`, `./edge-path.svelte`).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";

const root = join(import.meta.dirname, "..");

/** A feature as the guard reads it: its subpath and the source folders of its code. */
export interface FeatureSources {
    readonly subpath: string;
    readonly folders: readonly string[];
}

/** The features: each one's entry point (its subpath) and the folder of its code. */
export const FEATURES: readonly FeatureSources[] = [
    "selection",
    "subflows",
    "drag",
    "resize",
    "connection",
    "reconnection",
    "keyboard",
    "minimap",
].map((subpath) => ({
    subpath,
    folders: [
        `src/${subpath}/`,
        // the connection session the two connection features share (no entry of its own)
        ...(subpath === "connection" || subpath === "reconnection"
            ? ["src/connect-session/"]
            : []),
    ],
}));

/**
 * The built files a built file imports (`./name.js`, `../utils/x.js`, `./part.svelte`), relative
 * to its folder (`name.js`, `../utils/x.js`).
 */
export function chunksOf(source: string): string[] {
    return [
        ...source.matchAll(
            /(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+\.(?:m?js|svelte))["']/g,
        ),
    ].map(([, path]) => (path ?? "").replace(/^\.\//, ""));
}

/**
 * A package's built main entry, relative to its `dist`: the `import` (else `default`) target of its
 * published `exports["."]` (`index.js`; an Angular package's FESM bundle).
 */
export function mainEntryOf(manifest: {
    publishConfig?: { exports?: unknown };
    exports?: unknown;
}): string {
    const exports = (manifest.publishConfig?.exports ?? manifest.exports) as
        | Record<string, unknown>
        | undefined;
    const main = exports?.["."] as
        | { import?: string; default?: string }
        | string
        | undefined;
    const target =
        typeof main === "string" ? main : (main?.import ?? main?.default);
    return target?.startsWith("./dist/")
        ? target.slice("./dist/".length)
        : "index.js";
}

/** An import of a feature's entry point, from any package: `@fragiola/<package>/<subpath>`. */
function importsSubpath(source: string, subpath: string): boolean {
    return new RegExp(
        `(?:from|import)\\s*\\(?\\s*["']@fragiola/[\\w-]+/${subpath}(?:/[^"']*)?["']`,
    ).test(source);
}

/** The sources a built file's source map names, as written there (`../src/selection/selection.ts`). */
export function mapSources(map: string | undefined): string[] {
    if (map === undefined) return [];
    const parsed = JSON.parse(map) as { sources?: unknown };
    return Array.isArray(parsed.sources)
        ? parsed.sources.filter(
              (source): source is string => typeof source === "string",
          )
        : [];
}

/**
 * The feature code a main entry holds, through the chunks it imports: one line per feature source
 * or feature import found, with the file it is in. `read` gives a built file's source by its path
 * relative to the entry's folder, and `readMap` its source map (`undefined` for none). With
 * `unbundled` (a build that mirrors `src/`, without source maps), each file is its own source.
 */
export function featureLeaks(
    main: string,
    read: (name: string) => string | undefined,
    readMap: (name: string) => string | undefined,
    features: readonly FeatureSources[] = FEATURES,
    unbundled = false,
): string[] {
    const leaks: string[] = [];
    const seen = new Set<string>();
    const visit = (name: string) => {
        if (seen.has(name)) return;
        seen.add(name);
        const source = read(name);
        if (source === undefined) return;
        const sources = (
            unbundled ? [`../src/${name}`] : mapSources(readMap(name))
        ).map((path) => path.replaceAll("\\", "/"));
        for (const { subpath, folders } of features) {
            if (importsSubpath(source, subpath)) {
                leaks.push(`${name}: imports the ${subpath} entry`);
            }
            for (const path of sources) {
                if (folders.some((folder) => path.includes(folder))) {
                    leaks.push(`${name}: ${subpath}'s ${path}`);
                }
            }
        }
        for (const chunk of chunksOf(source)) {
            visit(posix.normalize(posix.join(posix.dirname(name), chunk)));
        }
    };
    visit(main);
    return leaks;
}

function main() {
    const problems: string[] = [];
    for (const pkg of readdirSync(join(root, "packages"))) {
        const dist = join(root, "packages", pkg, "dist");
        // a Svelte package (`svelte` in its manifest) is built file for file, without maps
        const manifest = JSON.parse(
            readFileSync(join(root, "packages", pkg, "package.json"), "utf8"),
        ) as { svelte?: string; publishConfig?: { exports?: unknown } };
        const main = mainEntryOf(manifest);
        if (!existsSync(join(dist, main))) {
            problems.push(
                `packages/${pkg}: no built main entry (dist/${main})`,
            );
            continue;
        }
        const read = (file: string) => {
            const path = join(dist, file);
            return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        };
        const readMap = (file: string) => read(`${file}.map`);
        const unbundled = manifest.svelte !== undefined;
        if (!unbundled && readMap(main) === undefined) {
            problems.push(`packages/${pkg}: no source map for the main entry`);
        }
        for (const leak of featureLeaks(
            main,
            read,
            readMap,
            FEATURES,
            unbundled,
        )) {
            problems.push(`packages/${pkg}/dist/${leak}`);
        }
    }
    if (problems.length > 0) {
        console.error(
            `A main entry ships a feature's code (a feature must stay in its own entry):\n${problems.join("\n")}`,
        );
        process.exit(1);
    }
    console.log(
        `check-features: no package's main entry ships ${FEATURES.map((feature) => feature.subpath).join(", ")}`,
    );
}

if (process.argv[1] === import.meta.filename) {
    main();
}
