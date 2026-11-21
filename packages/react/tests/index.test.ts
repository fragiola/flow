import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/flow";
import { describe, expect, it } from "vitest";
import * as connectionEntry from "../src/connection/index";
import * as dragEntry from "../src/drag/index";
import * as react from "../src/index";
import * as keyboardEntry from "../src/keyboard/index";
import * as minimapEntry from "../src/minimap/index";
import * as reconnectionEntry from "../src/reconnection/index";
import * as resizeEntry from "../src/resize/index";
import * as selectionEntry from "../src/selection/index";
import * as subflowsEntry from "../src/subflows/index";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** The package's own runtime exports, and the primitives of the namespace: the documented API. */
const OWN = [
    "Flow",
    "createFlowRef",
    "useConnection",
    "useEdge",
    "useEdges",
    "useFlow",
    "useFlowRef",
    "useHandle",
    "useNode",
    "useNodes",
    "useSelection",
    "useViewport",
];
const PRIMITIVES = [
    "Background",
    "ConnectionLine",
    "Controls",
    "Edge",
    "EdgeLabel",
    "EdgePath",
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

describe("@fragiola/flow-react", () => {
    it("re-exports the whole core", () => {
        expect(read("src/index.ts")).toMatch(
            /^export \* from "@fragiola\/flow";$/m,
        );
        const exported = new Map(Object.entries(react));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("exports exactly the documented runtime API besides the core", () => {
        const own = Object.keys(react).filter((name) => !(name in core));
        expect(own.sort()).toEqual([...OWN].sort());
        expect(Object.keys(react.Flow).sort()).toEqual(PRIMITIVES);
    });

    it("mirrors every feature entry of the core, with its factory, and the features' primitives", async () => {
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
        }
        expect(Object.keys(minimapEntry).sort()).toEqual([
            "MiniMap",
            "MiniMapMask",
            "MiniMapNode",
            "minimap",
        ]);
        expect(Object.keys(resizeEntry).sort()).toEqual([
            "NodeResizer",
            "RESIZE_POSITIONS",
            "ResizeHandle",
            "resize",
        ]);
    });

    it("never imports a feature from the main entry's modules", () => {
        const files = ["src/index.ts", "src/parts.ts", "src/context.ts"].map(
            read,
        );
        for (const source of files) {
            expect(source).not.toMatch(/@fragiola\/flow\/\w/);
            expect(source).not.toMatch(
                /from "\.\/(minimap|resize|selection|drag|connection|reconnection|keyboard|subflows)\//,
            );
        }
    });
});
