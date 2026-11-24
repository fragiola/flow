// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
    HANDLE_SIDES,
    type LayoutEdge,
    type LayoutNode,
    layoutPositions,
    RANKDIR,
} from "../src/examples/dagre-layout/layout";
import { clamp, easeInOut, tween } from "../src/examples/dagre-layout/tween";

// The dagre-layout example: the adapter (dagre's centres back as top-left corners, children below
// or to the right of their parents, no overlap), the handle sides per direction, and the tween
// (the easing's ends, the places at 0, 1 and midway).

const box = (id: string, width = 150, height = 44): LayoutNode => ({
    id,
    width,
    height,
});

const nodes: LayoutNode[] = [
    box("root"),
    box("a"),
    box("b", 200, 60),
    box("a1"),
    box("a2", 120, 30),
    box("b1"),
    box("join"),
];

const edges: LayoutEdge[] = [
    { source: "root", target: "a" },
    { source: "root", target: "b" },
    { source: "a", target: "a1" },
    { source: "a", target: "a2" },
    { source: "b", target: "b1" },
    { source: "a1", target: "join" },
    { source: "b1", target: "join" },
];

const sizeOf = (id: string) => nodes.find((node) => node.id === id) ?? box(id);

function rectsOf(positions: Map<string, { x: number; y: number }>) {
    return nodes.map((node) => {
        const at = positions.get(node.id);
        if (!at) throw new Error(`no place for ${node.id}`);
        return { ...node, ...at };
    });
}

describe("layoutPositions", () => {
    it("places every node", () => {
        for (const direction of ["vertical", "horizontal"] as const) {
            const positions = layoutPositions(nodes, edges, direction);
            expect([...positions.keys()].sort()).toEqual(
                nodes.map((node) => node.id).sort(),
            );
        }
    });

    it("puts every child below its parent, top to bottom", () => {
        const positions = layoutPositions(nodes, edges, "vertical");
        for (const { source, target } of edges) {
            const parent = positions.get(source);
            const child = positions.get(target);
            expect(child?.y ?? 0, `${target} under ${source}`).toBeGreaterThan(
                (parent?.y ?? 0) + sizeOf(source).height,
            );
        }
    });

    it("puts every child to the right of its parent, left to right", () => {
        const positions = layoutPositions(nodes, edges, "horizontal");
        for (const { source, target } of edges) {
            const parent = positions.get(source);
            const child = positions.get(target);
            expect(
                child?.x ?? 0,
                `${target} right of ${source}`,
            ).toBeGreaterThan((parent?.x ?? 0) + sizeOf(source).width);
        }
    });

    it("overlaps no two nodes", () => {
        for (const direction of ["vertical", "horizontal"] as const) {
            const rects = rectsOf(layoutPositions(nodes, edges, direction));
            for (const [index, a] of rects.entries()) {
                for (const b of rects.slice(index + 1)) {
                    const apart =
                        a.x + a.width <= b.x ||
                        b.x + b.width <= a.x ||
                        a.y + a.height <= b.y ||
                        b.y + b.height <= a.y;
                    expect(apart, `${a.id} and ${b.id} (${direction})`).toBe(
                        true,
                    );
                }
            }
        }
    });

    it("returns top-left corners: dagre's centre less half the size", () => {
        // a single node: dagre centres it at half its size from its margin-free origin
        const alone = layoutPositions([box("only", 100, 40)], [], "vertical");
        expect(alone.get("only")).toEqual({ x: 0, y: 0 });
        // a parent and a child of different widths share a centre line top to bottom
        const pair = layoutPositions(
            [box("wide", 200, 40), box("narrow", 80, 20)],
            [{ source: "wide", target: "narrow" }],
            "vertical",
            { nodes: 40, ranks: 50 },
        );
        const wide = pair.get("wide");
        const narrow = pair.get("narrow");
        expect((wide?.x ?? 0) + 100).toBeCloseTo((narrow?.x ?? 0) + 40);
        // the rank gap lies between the boxes' facing edges
        expect((narrow?.y ?? 0) - ((wide?.y ?? 0) + 40)).toBeCloseTo(50);
    });

    it("tells dagre TB for vertical and LR for horizontal", () => {
        expect(RANKDIR).toEqual({ vertical: "TB", horizontal: "LR" });
    });
});

describe("HANDLE_SIDES", () => {
    it("puts the input on top and the output below, vertically", () => {
        expect(HANDLE_SIDES.vertical).toEqual({
            target: "top",
            source: "bottom",
        });
    });

    it("puts the input on the left and the output on the right, horizontally", () => {
        expect(HANDLE_SIDES.horizontal).toEqual({
            target: "left",
            source: "right",
        });
    });
});

describe("easeInOut", () => {
    it("starts at 0, ends at 1, is ½ halfway and slow at the ends", () => {
        expect(easeInOut(0)).toBe(0);
        expect(easeInOut(1)).toBe(1);
        expect(easeInOut(0.5)).toBeCloseTo(0.5);
        expect(easeInOut(0.1)).toBeLessThan(0.1);
        expect(easeInOut(0.9)).toBeGreaterThan(0.9);
    });

    it("keeps its progress within [0, 1]", () => {
        expect(easeInOut(-1)).toBe(0);
        expect(easeInOut(2)).toBe(1);
        expect(clamp(-0.5)).toBe(0);
        expect(clamp(1.5)).toBe(1);
    });
});

describe("tween", () => {
    const from = new Map([
        ["a", { x: 0, y: 0 }],
        ["b", { x: 100, y: -50 }],
    ]);
    const to = new Map([
        ["a", { x: 200, y: 100 }],
        ["b", { x: 100, y: 50 }],
        ["c", { x: 7, y: 9 }],
    ]);

    it("is at the start at 0 and at the end at 1", () => {
        expect(tween(from, to, 0).get("a")).toEqual({ x: 0, y: 0 });
        expect(tween(from, to, 0).get("b")).toEqual({ x: 100, y: -50 });
        expect(tween(from, to, 1).get("a")).toEqual({ x: 200, y: 100 });
        expect(tween(from, to, 1).get("b")).toEqual({ x: 100, y: 50 });
    });

    it("is halfway at ½, and follows the easing elsewhere", () => {
        const half = tween(from, to, 0.5).get("a");
        expect(half?.x).toBeCloseTo(100);
        expect(half?.y).toBeCloseTo(50);
        const linear = tween(from, to, 0.25, (t) => t).get("a");
        expect(linear).toEqual({ x: 50, y: 25 });
        const eased = tween(from, to, 0.25).get("a");
        expect(eased?.x ?? 0).toBeLessThan(50);
    });

    it("leaves a node it has no start for at its end", () => {
        expect(tween(from, to, 0.3).get("c")).toEqual({ x: 7, y: 9 });
    });
});
