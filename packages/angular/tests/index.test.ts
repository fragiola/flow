import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/flow";
import { describe, expect, it } from "vitest";
import * as connectionEntry from "../src/connection/index";
import * as dragEntry from "../src/drag/index";
import * as keyboardEntry from "../src/keyboard/index";
import * as minimapEntry from "../src/minimap/index";
import * as angular from "../src/public-api";
import * as reconnectionEntry from "../src/reconnection/index";
import * as resizeEntry from "../src/resize/index";
import * as selectionEntry from "../src/selection/index";
import * as subflowsEntry from "../src/subflows/index";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** The package's own runtime exports: the documented API. */
const OWN = [
    "FLOW",
    "createFlowRef",
    "injectConnection",
    "injectEdge",
    "injectEdges",
    "injectFlow",
    "injectFlowRef",
    "injectHandle",
    "injectNode",
    "injectNodes",
    "injectSelection",
    "injectViewport",
];

/** React's primitives (`Flow.*`), as Angular directives: `Flow<Name>Directive`. */
const PRIMITIVES = [
    "Background",
    "ConnectionLine",
    "Controls",
    "Edge",
    "EdgeLabel",
    "EdgePath",
    "EdgeToolbar",
    "Edges",
    "FitView",
    "Handle",
    "Node",
    "NodeToolbar",
    "Nodes",
    "ReconnectAnchor",
    "Root",
    "SelectionBox",
    "ToggleInteractive",
    "Viewport",
    "ZoomIn",
    "ZoomOut",
];

/** The collections' templates (React's children functions of `Nodes` and `Edges`). */
const TEMPLATES = ["EdgesItem", "NodesItem"];

// #36: React's parts this adapter has not got yet; its #36 helper adds them and removes this list
const AHEAD_IN_REACT = ["NodesSelection:nodes-selection"];
const notAheadFile = (file: string) =>
    !AHEAD_IN_REACT.some((entry) => entry.endsWith(`:${file}`));

describe("@fragiola/flow-angular", () => {
    it("re-exports the whole core", () => {
        expect(read("src/public-api.ts")).toMatch(
            /^export \* from "@fragiola\/flow";$/m,
        );
        const exported = new Map(Object.entries(angular));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("exports exactly the documented runtime API besides the core, its own entries' helpers marked ɵ", () => {
        const own = Object.keys(angular).filter(
            (name) => !(name in core) && !name.startsWith("ɵ"),
        );
        const directives = [...PRIMITIVES, ...TEMPLATES].map(
            (name) => `Flow${name}Directive`,
        );
        expect(own.sort()).toEqual([...OWN, ...directives].sort());
        expect(angular.FLOW.map((directive) => directive.name).sort()).toEqual(
            directives.sort(),
        );
    });

    it("mirrors every feature entry of the core, with its factory, and the features' directives", async () => {
        const entries = {
            selection: selectionEntry,
            subflows: subflowsEntry,
            drag: dragEntry,
            resize: resizeEntry,
            connection: connectionEntry,
            reconnection: reconnectionEntry,
            keyboard: keyboardEntry,
            minimap: minimapEntry,
        };
        const pkg = JSON.parse(read("package.json")) as {
            exports: Record<string, unknown>;
        };
        const corePkg = JSON.parse(read("../core/package.json")) as {
            exports: Record<string, unknown>;
        };
        expect(Object.keys(pkg.exports)).toEqual(Object.keys(corePkg.exports));
        for (const [name, entry] of Object.entries(entries)) {
            const own = (await import(`@fragiola/flow/${name}`)) as Record<
                string,
                unknown
            >;
            expect((entry as Record<string, unknown>)[name], name).toBe(
                own[name],
            );
            // an ng-packagr secondary entry point per feature
            expect(
                JSON.parse(read(`${name}/ng-package.json`)).lib.entryFile,
            ).toBe(`../src/${name}/index.ts`);
        }
        expect(Object.keys(minimapEntry).sort()).toEqual([
            "FLOW_MINIMAP",
            "FlowMiniMapDirective",
            "FlowMiniMapMaskDirective",
            "FlowMiniMapNodeDirective",
            "minimap",
        ]);
        expect(Object.keys(resizeEntry).sort()).toEqual([
            "FLOW_RESIZE",
            "FlowNodeResizerDirective",
            "FlowResizeHandleDirective",
            "RESIZE_POSITIONS",
            "resize",
        ]);
    });

    it("names its directives' files as React's primitives, with Angular's .directive.ts", () => {
        const files = (dir: string, suffix: RegExp) =>
            readdirSync(join(import.meta.dirname, "..", dir))
                .map((file) => file.replace(suffix, ""))
                .sort();
        expect(files("src/lib/directives", /\.directive\.ts$/)).toEqual(
            files("../react/src/components", /\.tsx$/).filter(notAheadFile),
        );
        for (const dir of ["minimap", "resize"]) {
            expect(files(`src/${dir}`, /(\.directive)?\.ts$/), dir).toEqual(
                files(`../react/src/${dir}`, /\.tsx?$/),
            );
        }
        // each directive is in the file of its primitive's name
        for (const name of PRIMITIVES) {
            const file = name.replace(
                /[A-Z]/g,
                (letter, at: number) =>
                    `${at === 0 ? "" : "-"}${letter.toLowerCase()}`,
            );
            expect(
                read(`src/lib/directives/${file}.directive.ts`),
                file,
            ).toContain(`export class Flow${name}Directive`);
        }
    });

    it("never imports a feature from the main entry's modules", () => {
        const files = [
            "src/public-api.ts",
            ...["lib", "lib/directives", "lib/inject", "lib/utils"].flatMap(
                (dir) =>
                    readdirSync(join(import.meta.dirname, "..", "src", dir))
                        .filter((file) => file.endsWith(".ts"))
                        .map((file) => `src/${dir}/${file}`),
            ),
        ];
        for (const file of files) {
            const source = read(file);
            expect(source, file).not.toMatch(/@fragiola\/flow\/\w/);
            expect(source, file).not.toMatch(
                /from "\.\.?\/(\.\.\/)*(minimap|resize|selection|drag|connection|reconnection|keyboard|subflows)\//,
            );
        }
    });

    it("builds its feature entries on the main entry's public API only", () => {
        for (const dir of ["minimap", "resize"]) {
            for (const file of readdirSync(
                join(import.meta.dirname, "..", "src", dir),
            )) {
                expect(read(`src/${dir}/${file}`), file).not.toMatch(
                    /from "\.\.\//,
                );
            }
        }
    });
});
