// @vitest-environment jsdom
// `staticGeometry`: a flow's geometry from its document alone (declared sizes and handles), equal
// to the engine's measured geometry when the measured sizes and handles are the declared ones:
// handles on the four sides, a sub-flow, per-node origins, the engine's `nodeOrigin` and each
// `zIndexMode`.
import { afterEach, describe, expect, it } from "vitest";
import type { DeclaredHandle, FlowJson } from "../../src/document/types";
import type { FlowEngineOptions } from "../../src/engine/create-flow-engine";
import { staticGeometry } from "../../src/geometry/static-geometry";
import { createFlowModel } from "../../src/model/create-flow-model";
import { subflows } from "../../src/subflows/subflows";
import { type HandleSpec, mount, unmountAll } from "../engine/harness";

afterEach(unmountAll);

/** Each node: its position, size, origin, parent and handles (`[id, type, side, x, y]`, 10 × 10). */
const NODES: Record<
    string,
    {
        position: [number, number];
        size: [number, number];
        origin?: { x: number; y: number };
        parentId?: string;
        sourcePosition?: "right";
        handles: [
            string | undefined,
            "source" | "target",
            string,
            number,
            number,
        ][];
    }
> = {
    h: {
        position: [300, 200],
        size: [100, 40],
        origin: { x: 0.5, y: 0.5 },
        handles: [
            ["t", "source", "top", 45, -5],
            ["r", "source", "right", 95, 15],
            ["b", "source", "bottom", 45, 35],
            ["l", "source", "left", -5, 15],
        ],
    },
    n: {
        position: [300, 40],
        size: [80, 30],
        handles: [[undefined, "target", "bottom", 35, 25]],
    },
    e: {
        position: [520, 200],
        size: [80, 30],
        sourcePosition: "right",
        handles: [[undefined, "target", "left", -5, 10]],
    },
    s: {
        position: [300, 360],
        size: [80, 30],
        handles: [[undefined, "target", "top", 35, -5]],
    },
    w: {
        position: [80, 200],
        size: [80, 30],
        handles: [[undefined, "target", "right", 75, 10]],
    },
    p: {
        position: [700, 400],
        size: [200, 150],
        origin: { x: 0.5, y: 0 },
        handles: [],
    },
    c: {
        position: [20, 30],
        size: [50, 30],
        parentId: "p",
        handles: [["in", "target", "left", -5, 10]],
    },
};

const EDGES: FlowJson["edges"] = [
    { id: "hn", source: "h", sourceHandle: "t", target: "n" },
    {
        id: "he",
        source: "h",
        sourceHandle: "r",
        target: "e",
        type: "smoothstep",
    },
    { id: "hs", source: "h", sourceHandle: "b", target: "s", type: "step" },
    {
        id: "hw",
        source: "h",
        sourceHandle: "l",
        target: "w",
        type: "straight",
        zIndex: 3,
    },
    // e has no source handle: its sourcePosition; c's handle by id, inside its parent
    { id: "ec", source: "e", target: "c", targetHandle: "in" },
    // n has no source handle and no sourcePosition: its bottom; h has no target one: its top
    { id: "nh", source: "n", target: "h", type: "simplebezier" },
];

/** The document as a server renders it: sizes and handles declared. */
function declared(): FlowJson {
    return {
        version: 1,
        nodes: Object.entries(NODES).map(([id, node]) => ({
            id,
            type: "default",
            position: { x: node.position[0], y: node.position[1] },
            data: {},
            width: node.size[0],
            height: node.size[1],
            ...(node.origin ? { origin: node.origin } : {}),
            ...(node.parentId ? { parentId: node.parentId } : {}),
            ...(node.sourcePosition
                ? { sourcePosition: node.sourcePosition }
                : {}),
            handles: node.handles.map(
                ([handleId, type, side, x, y]): DeclaredHandle => ({
                    ...(handleId ? { id: handleId } : {}),
                    type,
                    position: side as DeclaredHandle["position"],
                    x,
                    y,
                    width: 10,
                    height: 10,
                }),
            ),
        })),
        edges: EDGES,
    };
}

/** The declared document as a model holds it (every id present). */
const loaded = () =>
    createFlowModel(declared(), { features: [subflows()] }).get("flow-json");

/** The same document as the engine sees it once rendered: nothing declared, all measured. */
function measured(engine: FlowEngineOptions) {
    const json = declared();
    return mount(
        {
            ...json,
            nodes: json.nodes.map(
                ({ width: _w, height: _h, handles: _handles, ...node }) => node,
            ),
        },
        {
            features: [subflows()],
            engine,
            sizes: Object.fromEntries(
                Object.entries(NODES).map(([id, node]) => [id, node.size]),
            ),
            handles: Object.entries(NODES).flatMap(([nodeId, node]) =>
                node.handles.map(
                    ([handleId, type, side, x, y]): HandleSpec => ({
                        nodeId,
                        ...(handleId ? { handleId } : {}),
                        type,
                        side: side as HandleSpec["side"],
                        x,
                        y,
                        size: 10,
                    }),
                ),
            ),
        },
    );
}

describe("staticGeometry", () => {
    it.each<[string, FlowEngineOptions]>([
        ["the defaults", {}],
        ["a centred nodeOrigin", { nodeOrigin: { x: 0.5, y: 0.5 } }],
        ["zIndexMode basic", { zIndexMode: "basic" }],
        ["zIndexMode manual", { zIndexMode: "manual" }],
        [
            "path options and elevation",
            {
                pathOptions: { curvature: 0.2, borderRadius: 2, offset: 8 },
                elevateNodesOnSelect: false,
            },
        ],
    ])("equals the engine's measured geometry (%s)", (_, options) => {
        const geometry = staticGeometry(loaded(), options);
        const { engine } = measured(options);
        for (const id of Object.keys(NODES)) {
            expect(geometry.nodeRects[id], id).toEqual(
                engine.get("node-rect-by", { nodeId: id }),
            );
            expect(geometry.nodeZIndexes[id], id).toBe(
                engine.get("node-z-index-by", { nodeId: id }),
            );
        }
        for (const edge of EDGES) {
            const id = edge.id as string;
            expect(geometry.edgePaths[id], id).toEqual(
                engine.get("edge-path-by", { edgeId: id }),
            );
        }
        expect(geometry.drawnEdges).toEqual(
            engine.get("drawn-edges").map((edge) => edge.id),
        );
        expect(geometry.layers).toEqual(engine.get("render-layers"));
    });

    it("puts each end at its declared handle's centre, on its side", () => {
        const geometry = staticGeometry(loaded());
        // h's box: centred on (300, 200), 100 × 40 → (250, 180)
        expect(geometry.nodeRects.h).toEqual({
            x: 250,
            y: 180,
            width: 100,
            height: 40,
        });
        expect(geometry.edgePaths.hn).toMatchObject({
            source: { x: 300, y: 180 },
            sourceSide: "top",
            target: { x: 340, y: 70 },
            targetSide: "bottom",
        });
        expect(geometry.edgePaths.he).toMatchObject({
            source: { x: 350, y: 200 },
            sourceSide: "right",
        });
        expect(geometry.edgePaths.hs).toMatchObject({
            source: { x: 300, y: 220 },
            sourceSide: "bottom",
        });
        expect(geometry.edgePaths.hw).toMatchObject({
            source: { x: 250, y: 200 },
            sourceSide: "left",
            target: { x: 160, y: 215 },
            targetSide: "right",
        });
        // e's source side (right); c inside p, whose box is centred horizontally on 700
        expect(geometry.nodeRects.c).toEqual({
            x: 620,
            y: 430,
            width: 50,
            height: 30,
        });
        expect(geometry.edgePaths.ec).toMatchObject({
            source: { x: 600, y: 215 },
            sourceSide: "right",
            target: { x: 620, y: 445 },
            targetSide: "left",
        });
        // n's default bottom, h's default top
        expect(geometry.edgePaths.nh).toMatchObject({
            source: { x: 340, y: 70 },
            sourceSide: "bottom",
            target: { x: 300, y: 180 },
            targetSide: "top",
        });
    });

    it("gives a node of unknown size a zero box and draws none of its edges", () => {
        const geometry = staticGeometry({
            nodes: [
                {
                    id: "a",
                    type: "default",
                    position: { x: 10, y: 20 },
                    data: {},
                },
                {
                    id: "b",
                    type: "default",
                    position: { x: 200, y: 20 },
                    data: {},
                    width: 50,
                    height: 20,
                },
            ],
            edges: [{ id: "ab", source: "a", target: "b" }],
        });
        expect(geometry.nodeRects.a).toEqual({
            x: 10,
            y: 20,
            width: 0,
            height: 0,
        });
        expect(geometry.edgePaths.ab).toBeUndefined();
        expect(geometry.drawnEdges).toEqual([]);
        expect(geometry.layers).toEqual([
            { level: 0, zIndex: undefined, nodeIds: ["a", "b"], edgeIds: [] },
        ]);
    });

    it("uses initial sizes, leaves hidden nodes and edges out, and is frozen", () => {
        const geometry = staticGeometry({
            nodes: [
                {
                    id: "a",
                    type: "default",
                    position: { x: 0, y: 0 },
                    data: {},
                    initialWidth: 40,
                    initialHeight: 20,
                },
                {
                    id: "b",
                    type: "default",
                    position: { x: 0, y: 100 },
                    data: {},
                    width: 60,
                    initialWidth: 10,
                    initialHeight: 30,
                },
                {
                    id: "x",
                    type: "default",
                    position: { x: 0, y: 300 },
                    data: {},
                    width: 10,
                    height: 10,
                    hidden: true,
                },
            ],
            edges: [
                { id: "ab", source: "a", target: "b" },
                { id: "ax", source: "a", target: "x" },
                { id: "ba", source: "b", target: "a", hidden: true },
            ],
        });
        // width wins over initialWidth
        expect(geometry.nodeRects.b).toEqual({
            x: 0,
            y: 100,
            width: 60,
            height: 30,
        });
        expect(geometry.edgePaths.ab).toMatchObject({
            source: { x: 20, y: 20 },
            target: { x: 30, y: 100 },
        });
        expect(geometry.drawnEdges).toEqual(["ab"]);
        expect(geometry.layers[0]?.nodeIds).toEqual(["a", "b"]);
        expect(Object.isFrozen(geometry)).toBe(true);
        expect(Object.isFrozen(geometry.nodeRects)).toBe(true);
        expect(Object.isFrozen(geometry.edgePaths.ab)).toBe(true);
        expect(Object.isFrozen(geometry.layers[0])).toBe(true);
    });
});
