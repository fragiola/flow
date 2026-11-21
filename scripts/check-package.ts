// From Splitter (fragiola/splitter, scripts/check-package.ts), same author and licence.
// Fails when a package cannot be published as it is. Run by `pnpm check:package`, after the
// packages built. Nothing is published yet (AGENTS.md, D15): this is a packaging check only. Each
// package is packed with pnpm, which applies `publishConfig` as a publish would (npm would not:
// the packages are only ever packed and published through pnpm), then:
//
// - its packed `exports` (from `publishConfig.exports`) are the repo's `exports` without the source
//   condition, and use only the `types`, `import` and `default` conditions, with targets in `dist`.
//   A package published from its build output (`publishConfig.directory`, as an Angular adapter
//   built by ng-packagr) is packed from that directory: its packed `exports` are the repo's
//   without the source condition, relative to it (`./dist/x` is `./x`), and every target is a
//   file of the tarball;
// - publint (strict) and attw (`esm-only` profile) pass on the tarball;
// - every adapter (`ADAPTERS`: each package under packages/ but the core) depends on the core at
//   its exact version, and passes its smoke test: a scratch app outside the workspace installs
//   that adapter's tarball (the core tarball comes as its dependency), typechecks, builds and
//   loads its dev server. React's is a Vite + React app at the pins of examples/react once that
//   app exists (packages/react's own pins until then); each later adapter Epic (Vue, Svelte,
//   Angular) adds its entry and its smoke app, as Splitter's. A consumer's dev server adds the
//   `development` condition, which once pointed Dockable's published `exports` at sources that
//   are not in the tarball.
import { execFileSync, spawn } from "node:child_process";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SOURCE_CONDITION } from "./source-condition.ts";

const root = join(import.meta.dirname, "..");

/** The only conditions a published `exports` may use: ESM, with its types. */
const PUBLISHED_CONDITIONS = ["types", "import", "default"];

/** A published target is in `dist` (`./dist/…`). */
const inDist = (target: string) => target.startsWith("./dist/");

/**
 * What is wrong with published `exports`: a condition other than `types`, `import` and `default`
 * (a source condition, `development`, …), or a target outside `dist` (`published` says what is
 * published, for a package packed from its build output: the tarball's files).
 */
export function exportProblems(
    exports: unknown,
    path = "exports",
    published: (target: string) => boolean = inDist,
): string[] {
    if (typeof exports === "string") {
        return published(exports) || exports === "./package.json"
            ? []
            : [`${path}: "${exports}" is not in dist`];
    }
    if (exports === null || typeof exports !== "object") {
        return [`${path}: not a string or an object`];
    }
    return Object.entries(exports).flatMap(([key, value]) => [
        ...(key.startsWith(".") || PUBLISHED_CONDITIONS.includes(key)
            ? []
            : [`${path}: the "${key}" condition is published`]),
        ...exportProblems(value, `${path}["${key}"]`, published),
    ]);
}

/**
 * `exports` with every target relative to `directory` (`./dist/x` is `./x` for `dist`): what a
 * package packed from `directory` (`publishConfig.directory`) publishes.
 */
export function relativeTo(exports: unknown, directory: string): unknown {
    const prefix = `./${directory.replace(/^\.\/|\/$/g, "")}/`;
    if (typeof exports === "string") {
        return exports.startsWith(prefix)
            ? `./${exports.slice(prefix.length)}`
            : exports;
    }
    if (exports === null || typeof exports !== "object") return exports;
    return Object.fromEntries(
        Object.entries(exports).map(([key, value]) => [
            key,
            relativeTo(value, directory),
        ]),
    );
}

/** `exports` without the source condition, at any depth (key order kept: it is the priority). */
export function withoutSource(exports: unknown): unknown {
    if (exports === null || typeof exports !== "object") return exports;
    return Object.fromEntries(
        Object.entries(exports)
            .filter(([key]) => key !== SOURCE_CONDITION)
            .map(([key, value]) => [key, withoutSource(value)]),
    );
}

/**
 * Whether the published `exports` (`publishConfig.exports`, a hand-written copy) are the repo's
 * `exports` without the source condition: the same subpaths, conditions, order and targets.
 */
export function publishedExportsProblems(
    exports: unknown,
    published: unknown,
): string[] {
    const expected = JSON.stringify(withoutSource(exports));
    const actual = JSON.stringify(published);
    return expected === actual
        ? []
        : [`published exports ${actual} are not the exports ${expected}`];
}

function run(command: string, args: string[], cwd: string): void {
    execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** `pnpm pack` of `packages/<name>` into `dir`; returns the tarball's path. */
function pack(name: string, dir: string): string {
    const output = execFileSync(
        "pnpm",
        ["pack", "--pack-destination", dir, "--json"],
        { cwd: join(root, "packages", name), encoding: "utf8" },
    );
    const { filename } = JSON.parse(output) as { filename: string };
    return filename;
}

interface PackedManifest {
    name: string;
    version: string;
    exports?: unknown;
    dependencies?: Record<string, string>;
}

function packedManifest(tarball: string): PackedManifest {
    return JSON.parse(
        execFileSync("tar", ["-xOzf", tarball, "package/package.json"], {
            encoding: "utf8",
        }),
    );
}

/** `packages/<name>/package.json`: its `exports` (the source condition included), what it packs. */
function repoManifest(name: string): {
    exports?: unknown;
    publishConfig?: { directory?: string };
} {
    return JSON.parse(
        readFileSync(join(root, "packages", name, "package.json"), "utf8"),
    );
}

/** The files of a tarball, as `./path` relative to the package. */
function tarballFiles(tarball: string): Set<string> {
    return new Set(
        execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
            .split("\n")
            .filter((line) => line.startsWith("package/"))
            .map((line) => `./${line.slice("package/".length)}`),
    );
}

function lint(name: string, tarball: string): string[] {
    const manifest = packedManifest(tarball);
    const repo = repoManifest(name);
    const directory = repo.publishConfig?.directory;
    const files = tarballFiles(tarball);
    const problems = (
        directory === undefined
            ? [
                  ...exportProblems(manifest.exports),
                  ...publishedExportsProblems(repo.exports, manifest.exports),
              ]
            : [
                  ...exportProblems(manifest.exports, "exports", (target) =>
                      files.has(target),
                  ),
                  ...publishedExportsProblems(
                      relativeTo(repo.exports, directory),
                      manifest.exports,
                  ),
              ]
    ).map((problem) => `${manifest.name}: ${problem}`);
    run("pnpm", ["exec", "publint", tarball, "--strict"], root);
    run("pnpm", ["exec", "attw", tarball, "--profile", "esm-only"], root);
    return problems;
}

/** A framework Flow has (or will have) an adapter for. */
export type Framework = "react" | "vue" | "svelte" | "angular";

/** What `check:package` checks of an adapter, besides what every package gets. */
export interface AdapterCheck {
    /** its directory, `packages/<dir>` */
    dir: string;
    /** the framework whose examples app (`examples/<framework>`) pins the smoke app's versions */
    framework: Framework;
    /**
     * Its smoke test, in an empty scratch directory outside the workspace: an app that installs
     * the adapter's tarball only (the core tarball comes as its dependency), typechecks, builds and
     * loads its dev server. Throws on any failure.
     */
    smoke: (
        app: string,
        tarballs: { core: string; adapter: string },
    ) => Promise<void>;
}

/**
 * The pins a smoke app installs that no package of the repo pins yet: the Vite plugin of the React
 * examples app (fragiola/flow#6), Splitter's pin until that app exists.
 */
const SMOKE_PINS: Readonly<Record<string, string>> = {
    "@vitejs/plugin-react": "6.1.1",
};

/**
 * The version of `name` a framework's smoke app installs, so that it installs nothing new: its
 * examples app's pin (examples/<framework>), else its package's own (packages/<framework>), else
 * {@link SMOKE_PINS}.
 */
export function smokeVersion(framework: Framework, name: string): string {
    for (const manifestPath of [
        join(root, "examples", framework, "package.json"),
        join(root, "packages", framework, "package.json"),
    ]) {
        if (!existsSync(manifestPath)) continue;
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        const version =
            manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
        if (version !== undefined && !version.startsWith("workspace:"))
            return version;
    }
    const pinned = SMOKE_PINS[name];
    if (pinned === undefined) {
        throw new Error(`no pin of ${name} for the ${framework} smoke app`);
    }
    return pinned;
}

// The React package only, the core's names included: a React app installs that one only. A
// typed registry, a model with features from the package's subpaths, the primitives with a
// children function per node and per edge, the minimap's own entry, and a core rule.
const SMOKE_MAIN = `import {
    createFlowModel,
    Flow,
    type FlowJson,
    type FlowModel,
    type FlowTypes,
    useFlowRef,
} from "@fragiola/flow-react";
import { connection } from "@fragiola/flow-react/connection";
import { drag } from "@fragiola/flow-react/drag";
import { MiniMap, minimap } from "@fragiola/flow-react/minimap";
import { NodeResizer, resize } from "@fragiola/flow-react/resize";
import { selection } from "@fragiola/flow-react/selection";
import { createRoot } from "react-dom/client";

interface Types extends FlowTypes {
    readonly nodes: { task: { title: string } };
}

const features = [selection(), drag(), connection(), resize(), minimap()] as const;

const json: FlowJson<Types> = {
    version: 1,
    nodes: [
        { id: "a", type: "task", position: { x: 0, y: 0 }, data: { title: "A" } },
        { id: "b", type: "task", position: { x: 0, y: 200 }, data: { title: "B" } },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
};

const model: FlowModel<Types, typeof features> = createFlowModel<Types, typeof features>(
    json,
    { features },
);

function App() {
    const flow = useFlowRef<Types, typeof features>();
    return (
        <Flow.Root<Types, typeof features> model={model} flowRef={flow} style={{ height: "100vh" }}>
            <Flow.Background variant="dots" />
            <Flow.Viewport>
                <Flow.Edges<Types>>
                    {(edge) => (
                        <Flow.Edge<Types> edge={edge}>
                            <Flow.EdgePath />
                        </Flow.Edge>
                    )}
                </Flow.Edges>
                <Flow.Nodes<Types>>
                    {(node) => (
                        <Flow.Node<Types> node={node} className={(state) => (state.selected ? "selected" : "")}>
                            {node.data.title}
                            <Flow.Handle type="target" side="top" />
                            <Flow.Handle type="source" side="bottom" />
                            <NodeResizer minWidth={40} />
                        </Flow.Node>
                    )}
                </Flow.Nodes>
                <Flow.ConnectionLine />
            </Flow.Viewport>
            <Flow.Controls>
                <Flow.ZoomIn aria-label="Zoom in">+</Flow.ZoomIn>
                <Flow.FitView aria-label="Fit view" onClick={() => console.log(flow.current?.engine.get("viewport"))}>
                    Fit
                </Flow.FitView>
            </Flow.Controls>
            <MiniMap width={200} height={150} />
        </Flow.Root>
    );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<App />);
`;

/**
 * A scratch Vite + React app in `dir` that depends on the React tarball only: the core tarball is
 * installed as its dependency, never declared by the app.
 */
function writeReactSmokeApp(dir: string, core: string, react: string): void {
    const version = (name: string) => smokeVersion("react", name);
    const manifest = {
        name: "flow-smoke",
        private: true,
        type: "module",
        dependencies: {
            "@fragiola/flow-react": `file:${react}`,
            react: version("react"),
            "react-dom": version("react-dom"),
        },
        devDependencies: {
            "@types/react": version("@types/react"),
            "@types/react-dom": version("@types/react-dom"),
            "@vitejs/plugin-react": version("@vitejs/plugin-react"),
            typescript: version("typescript"),
            vite: version("vite"),
        },
    };
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );
    // The React tarball depends on the core at its own version, which the registry may not have:
    // the packed core stands in for it. A file of its own also keeps the app out of any workspace.
    writeFileSync(
        join(dir, "pnpm-workspace.yaml"),
        `overrides:\n  "@fragiola/flow": "file:${core}"\n`,
    );
    writeFileSync(
        join(dir, "vite.config.js"),
        `import react from "@vitejs/plugin-react";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [react()] });\n`,
    );
    writeFileSync(
        join(dir, "index.html"),
        `<!doctype html>\n<html lang="en">\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
    );
    // strict, with the published declarations checked too (no skipLibCheck)
    const tsconfig = {
        compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            noUncheckedIndexedAccess: true,
            verbatimModuleSyntax: true,
            noEmit: true,
            types: [],
        },
        include: ["src"],
    };
    writeFileSync(
        join(dir, "tsconfig.json"),
        `${JSON.stringify(tsconfig, null, 4)}\n`,
    );
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/main.tsx"), SMOKE_MAIN);
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port =
                typeof address === "object" && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

async function fetchOk(url: string): Promise<string> {
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
        throw new Error(`${url}: ${response.status}\n${body.slice(0, 2000)}`);
    }
    return body;
}

/** The absolute imports of a module served by Vite (`/node_modules/.vite/deps/…`, `/@id/…`). */
export function servedImports(code: string): string[] {
    return [...code.matchAll(/(?:from|import)\s*["'](\/[^"']+)["']/g)].flatMap(
        ([, path]) => (path === undefined ? [] : [path]),
    );
}

/**
 * Starts the app's dev server, loads its entry (`/src/main.tsx`) and every module it imports, then
 * stops it.
 */
async function loadThroughDevServer(
    dir: string,
    entryPath: string,
): Promise<void> {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const server = spawn(
        process.execPath,
        [
            join(dir, "node_modules/vite/bin/vite.js"),
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--strictPort",
        ],
        { cwd: dir, stdio: "inherit" },
    );
    const exited = new Promise<void>((resolve) => {
        server.once("exit", () => resolve());
    });
    try {
        const deadline = Date.now() + 30_000;
        for (;;) {
            try {
                await fetchOk(`${base}/`);
                break;
            } catch (error) {
                if (Date.now() > deadline) throw error;
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }
        const entry = await fetchOk(`${base}${entryPath}`);
        const imports = servedImports(entry);
        if (!imports.some((path) => path.includes("@fragiola"))) {
            throw new Error(
                `the dev server's entry imports no package:\n${entry}`,
            );
        }
        for (const path of imports) {
            await fetchOk(`${base}${path}`);
        }
        console.log(
            `check-package: the dev server loads the entry (${imports.length} imports)`,
        );
    } finally {
        // the app's directory is removed next: the server must be gone first
        server.kill();
        await exited;
    }
}

/**
 * The React smoke test: the scratch Vite + React app installs the React tarball, typechecks,
 * builds and loads its dev server.
 */
async function reactSmoke(
    app: string,
    tarballs: { core: string; adapter: string },
): Promise<void> {
    writeReactSmokeApp(app, tarballs.core, tarballs.adapter);
    run("pnpm", ["install", "--no-frozen-lockfile"], app);
    run("pnpm", ["exec", "tsc", "--noEmit"], app);
    run("pnpm", ["exec", "vite", "build"], app);
    await loadThroughDevServer(app, "/src/main.tsx");
}

/**
 * Every adapter, one per package under packages/ but the core (`unlistedPackages` checks it):
 * React; Vue, Svelte and Angular are added in that order by their Epics.
 */
export const ADAPTERS: readonly AdapterCheck[] = [
    { dir: "react", framework: "react", smoke: reactSmoke },
];

/** The packages/ directories that are neither the core nor an adapter of `adapters`. */
export function unlistedPackages(
    dirs: readonly string[],
    adapters: readonly AdapterCheck[] = ADAPTERS,
): string[] {
    return dirs.filter(
        (dir) =>
            dir !== "core" && !adapters.some((adapter) => adapter.dir === dir),
    );
}

/**
 * Why an adapter's packed manifest does not pin the core at its exact version, or nothing: one
 * core per page, whatever the adapters a page loads.
 */
export function corePinProblem(
    adapter: { name: string; dependencies?: Record<string, string> },
    coreVersion: string,
): string | undefined {
    const pinned = adapter.dependencies?.["@fragiola/flow"];
    return pinned === coreVersion
        ? undefined
        : `${adapter.name} depends on the core at "${pinned}", not at ${coreVersion}`;
}

async function main() {
    const packs = mkdtempSync(join(tmpdir(), "flow-pack-"));
    const apps: string[] = [];
    try {
        const names = readdirSync(join(root, "packages"));
        const tarballs = new Map(
            names.map((name) => [name, pack(name, packs)]),
        );
        const problems = [...tarballs].flatMap(([name, tarball]) =>
            lint(name, tarball),
        );
        if (problems.length > 0) {
            throw new Error(
                `The packed exports are wrong:\n${problems.join("\n")}`,
            );
        }
        const unlisted = unlistedPackages(names);
        if (unlisted.length > 0) {
            throw new Error(
                `packages/${unlisted.join(", packages/")}: not the core and not in ADAPTERS (scripts/check-package.ts)`,
            );
        }
        const core = tarballs.get("core");
        if (core === undefined) throw new Error("packages/core is expected");
        const coreVersion = packedManifest(core).version;
        for (const adapter of ADAPTERS) {
            const tarball = tarballs.get(adapter.dir);
            if (tarball === undefined) {
                throw new Error(`packages/${adapter.dir} is expected`);
            }
            const problem = corePinProblem(
                packedManifest(tarball),
                coreVersion,
            );
            if (problem) throw new Error(problem);
            const app = mkdtempSync(
                join(tmpdir(), `flow-smoke-${adapter.dir}-`),
            );
            apps.push(app);
            await adapter.smoke(app, { core, adapter: tarball });
            console.log(`check-package: ${adapter.dir}: the smoke app passes`);
        }
        console.log("check-package: every package can be published");
    } finally {
        for (const dir of [packs, ...apps]) {
            rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
        }
    }
}

// only when run, not when a test imports it (`import.meta.main` holds through a symlinked path)
if (import.meta.main) {
    await main();
}
