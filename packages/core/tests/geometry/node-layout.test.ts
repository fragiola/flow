// The pure node layout: a node's size (given, measured, initial), its origin (its own, the flow's,
// a child's top-left corner), its absolute place through its parents and its box, the handle rule
// and a declared handle's centre.
import { describe, expect, it } from "vitest";
import type { FlowNode } from "../../src/document/types";
import {
    declaredHandleOf,
    matchHandle,
    type NodeLayout,
    nodeAbsolutePosition,
    nodeOriginOf,
    nodeRectOf,
    nodeSize,
} from "../../src/geometry/node-layout";

const node = (id: string, extra: Partial<FlowNode> = {}): FlowNode => ({
    id,
    type: "default",
    position: { x: 100, y: 100 },
    data: {},
    ...extra,
});

describe("nodeSize", () => {
    it("takes the given size, else the measured one, else the initial one, per dimension", () => {
        expect(nodeSize(node("a"))).toBeUndefined();
        expect(
            nodeSize(node("a", { initialWidth: 10, initialHeight: 20 })),
        ).toEqual({ width: 10, height: 20 });
        expect(
            nodeSize(node("a", { initialWidth: 10, initialHeight: 20 }), {
                width: 30,
                height: 40,
            }),
        ).toEqual({ width: 30, height: 40 });
        expect(
            nodeSize(node("a", { width: 5, initialHeight: 20 }), undefined),
        ).toEqual({ width: 5, height: 20 });
        expect(nodeSize(node("a", { width: 5 }))).toBeUndefined();
    });
});

describe("the layout", () => {
    const nodes = new Map<string, FlowNode>(
        [
            node("p", { origin: { x: 0.5, y: 0.5 }, width: 200, height: 100 }),
            node("c", {
                parentId: "p",
                position: { x: 10, y: 20 },
                origin: { x: 1, y: 1 },
                width: 20,
                height: 20,
            }),
            node("free", { width: 40, height: 40 }),
            node("orphan", { parentId: "gone", width: 40, height: 40 }),
        ].map((n) => [n.id, n]),
    );
    const layout: NodeLayout = {
        node: (id) => nodes.get(id),
        size: (n) => nodeSize(n),
        nodeOrigin: { x: 1, y: 0 },
    };
    const at = (id: string) => nodes.get(id) as FlowNode;

    it("takes a node's own origin, else the flow's; a child keeps its top-left corner", () => {
        expect(nodeOriginOf(at("p"), layout)).toEqual({ x: 0.5, y: 0.5 });
        expect(nodeOriginOf(at("free"), layout)).toEqual({ x: 1, y: 0 });
        expect(nodeOriginOf(at("c"), layout)).toEqual({ x: 0, y: 0 });
        // a missing parent: the node is on the flow
        expect(nodeOriginOf(at("orphan"), layout)).toEqual({ x: 1, y: 0 });
    });

    it("places a child from its parent's box", () => {
        expect(nodeRectOf(at("p"), layout)).toEqual({
            x: 0,
            y: 50,
            width: 200,
            height: 100,
        });
        expect(nodeAbsolutePosition(at("c"), layout)).toEqual({ x: 10, y: 70 });
        expect(nodeRectOf(at("c"), layout)).toEqual({
            x: 10,
            y: 70,
            width: 20,
            height: 20,
        });
        expect(nodeRectOf(at("free"), layout)).toMatchObject({ x: 60, y: 100 });
        // no size: a zero box at the position
        expect(
            nodeRectOf(node("x"), { ...layout, nodeOrigin: undefined }),
        ).toEqual({ x: 100, y: 100, width: 0, height: 0 });
    });

    it("survives a cycle of parents", () => {
        const loop = new Map<string, FlowNode>([
            ["a", node("a", { parentId: "b" })],
            ["b", node("b", { parentId: "a" })],
        ]);
        expect(
            nodeAbsolutePosition(loop.get("a") as FlowNode, {
                node: (id) => loop.get(id),
                size: () => undefined,
                nodeOrigin: undefined,
            }),
        ).toEqual({ x: 200, y: 200 });
    });
});

describe("handles", () => {
    const list = [
        { type: "source", handleId: "x" },
        { type: "target", handleId: undefined },
        { type: "source", handleId: undefined },
        { type: "target", handleId: "y" },
    ] as const;

    it("match by the engine's rule", () => {
        expect(matchHandle(list, "source", undefined)).toBe(list[2]);
        expect(matchHandle(list.slice(0, 2), "source", undefined)).toBe(
            list[0],
        );
        expect(matchHandle(list, "target", "y")).toBe(list[3]);
        // an id of the other type
        expect(matchHandle(list, "source", "y")).toBe(list[3]);
        expect(matchHandle(list, "source", "z")).toBeUndefined();
    });

    it("place a declared one at its box's centre on the node's box", () => {
        const rect = { x: 10, y: 20, width: 100, height: 50 };
        const declared = node("a", {
            handles: [
                {
                    id: "r",
                    type: "source",
                    position: "right",
                    x: 95,
                    y: 20,
                    width: 10,
                    height: 10,
                },
                { type: "target", position: "top", x: 50, y: 0 },
            ],
        });
        expect(declaredHandleOf(declared, rect, "source", "r")).toEqual({
            side: "right",
            center: { x: 110, y: 45 },
        });
        expect(declaredHandleOf(declared, rect, "target", undefined)).toEqual({
            side: "top",
            center: { x: 60, y: 20 },
        });
        expect(declaredHandleOf(node("b"), rect, "source", undefined)).toBe(
            undefined,
        );
    });
});
