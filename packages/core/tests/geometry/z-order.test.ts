// The pure stacking helpers: each node's and edge's stack value by `zIndexMode`, the drawing order
// and the render layers (`renderLayers`), with no engine.
import { describe, expect, it } from "vitest";
import type { FlowEdge, FlowNode } from "../../src/document/types";
import {
    drawingOrder,
    edgeStackValue,
    nodeStackValue,
    renderLayers,
    SELECTED_RAISE,
} from "../../src/geometry/z-order";

const node = (id: string, extra: Partial<FlowNode> = {}): FlowNode => ({
    id,
    type: "default",
    position: { x: 0, y: 0 },
    data: {},
    ...extra,
});

const nodes = new Map<string, FlowNode>(
    [
        node("p", { zIndex: 2 }),
        node("c", { parentId: "p" }),
        node("s", { selected: true }),
        node("top", { zIndex: 7 }),
    ].map((n) => [n.id, n]),
);
const byId = (id: string) => nodes.get(id);
const value = (id: string, options = {}) =>
    nodeStackValue(byId(id) as FlowNode, byId, options);

describe("nodeStackValue", () => {
    it("keeps a child above its parent and raises a selected node, except in manual", () => {
        expect(value("p")).toBe(2);
        expect(value("c")).toBe(3);
        expect(value("s")).toBe(SELECTED_RAISE);
        expect(value("s", { elevateNodesOnSelect: false })).toBe(0);
        expect(value("c", { zIndexMode: "basic" })).toBe(3);
        expect(value("c", { zIndexMode: "manual" })).toBe(0);
        expect(value("s", { zIndexMode: "manual" })).toBe(0);
        expect(value("top", { zIndexMode: "manual" })).toBe(7);
        expect(
            nodeStackValue(node("x", { zIndex: Number.NaN }), byId, {}),
        ).toBe(0);
    });
});

describe("edgeStackValue", () => {
    const edge = (extra: Partial<FlowEdge> = {}): FlowEdge => ({
        id: "e",
        source: "c",
        target: "top",
        ...extra,
    });
    it("stands at least at a child end's value in auto, not in basic or manual", () => {
        // c (3) is a child: the edge stands at max(0, 3, 7)
        expect(edgeStackValue(edge(), byId, {})).toBe(7);
        expect(edgeStackValue(edge(), byId, { zIndexMode: "basic" })).toBe(0);
        expect(edgeStackValue(edge({ zIndex: 9 }), byId, {})).toBe(9);
        // no child end: its own zIndex
        expect(
            edgeStackValue(edge({ source: "p", target: "top" }), byId, {}),
        ).toBe(0);
    });

    it("ignores the ends' selection raise", () => {
        expect(
            edgeStackValue(edge({ source: "c", target: "s" }), byId, {}),
        ).toBe(3);
    });

    it("raises a selected edge by default in auto, only with elevateEdgesOnSelect in basic", () => {
        const selected = edge({ source: "p", target: "top", selected: true });
        expect(edgeStackValue(selected, byId, {})).toBe(SELECTED_RAISE);
        expect(
            edgeStackValue(selected, byId, { elevateEdgesOnSelect: false }),
        ).toBe(0);
        expect(edgeStackValue(selected, byId, { zIndexMode: "basic" })).toBe(0);
        expect(
            edgeStackValue(selected, byId, {
                zIndexMode: "basic",
                elevateEdgesOnSelect: true,
            }),
        ).toBe(SELECTED_RAISE);
        expect(
            edgeStackValue({ ...selected, zIndex: 4 }, byId, {
                zIndexMode: "manual",
                elevateEdgesOnSelect: true,
            }),
        ).toBe(4);
    });
});

describe("drawingOrder", () => {
    it("sorts by value, keeping the given order among equals", () => {
        expect(
            drawingOrder(["a", "b", "c", "d"], (id) => (id === "b" ? 2 : 0)),
        ).toEqual(["a", "c", "d", "b"]);
    });
});

describe("renderLayers", () => {
    const stacked = (entries: Record<string, number>) =>
        Object.entries(entries).map(([id, v]) => ({ id, value: v }));

    it("gives one level in basic, with no node, or when no edge stands above the lowest node", () => {
        const single = {
            layers: [
                {
                    level: 0,
                    zIndex: undefined,
                    nodeIds: ["a", "b"],
                    edgeIds: ["x"],
                },
            ],
            zIndexes: undefined,
        };
        expect(
            renderLayers(stacked({ a: 0, b: 5 }), stacked({ x: 9 }), "basic"),
        ).toEqual(single);
        expect(
            renderLayers(stacked({ a: 0, b: 5 }), stacked({ x: 0 }), "auto"),
        ).toEqual(single);
        expect(renderLayers([], stacked({ x: 9 })).layers).toHaveLength(1);
    });

    it("starts a level at each distinct edge value above the lowest node, an equal node above it", () => {
        const { layers, zIndexes } = renderLayers(
            stacked({ low: 0, mid: 1, high: 3, top: 9 }),
            stacked({ e0: 0, e1: 1, e3: 3, e3b: 3 }),
        );
        expect(layers).toEqual([
            { level: 0, zIndex: -7, nodeIds: ["low"], edgeIds: ["e0"] },
            { level: 1, zIndex: -5, nodeIds: ["mid"], edgeIds: ["e1"] },
            {
                level: 2,
                zIndex: -3,
                nodeIds: ["high", "top"],
                edgeIds: ["e3", "e3b"],
            },
        ]);
        // the ranks: e0, low, e1, mid, e3*, high, top → -7 … -1
        expect(Object.fromEntries(zIndexes ?? [])).toEqual({
            low: -6,
            mid: -4,
            high: -2,
            top: -1,
        });
    });
});
