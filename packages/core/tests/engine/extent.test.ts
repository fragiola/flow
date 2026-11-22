// @vitest-environment jsdom
// Extents: a node's rectangle `extent` (in the coordinates of its position: relative to its parent
// for a child) and the engine's `nodeExtent` bound its box when it is dragged, moved by the arrows
// or resized, with the measured sizes; the document's schema takes `"parent"` or a rectangle.
import { afterEach, describe, expect, it } from "vitest";
import { validateFlow } from "../../src/document/validate-flow";
import { drag } from "../../src/drag/drag";
import { keyboard } from "../../src/keyboard/keyboard";
import { resize } from "../../src/resize/resize";
import { subflows } from "../../src/subflows/subflows";
import { drag as dragOn, flowOf, key, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const BOX = { x: 0, y: 0, width: 300, height: 200 };

const positionOf = (
    flow: { model: { get(key: "node-by", payload: { id: string }): unknown } },
    id: string,
) => (flow.model.get("node-by", { id }) as { position: unknown }).position;

/** A resize handle at `position` inside a node's element. */
function resizeHandle(node: HTMLElement, position: string): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-flow-part", "resize-handle");
    element.setAttribute("data-position", position);
    node.append(element);
    return element;
}

/** `n` (100 × 50) at (100, 100) with a rectangle extent. */
const bounded = () => {
    const json = flowOf({ n: [100, 100] });
    json.nodes[0] = { ...json.nodes[0], extent: BOX } as (typeof json.nodes)[0];
    return mount(json, {
        features: [subflows(), drag(), keyboard(), resize()],
        sizes: { n: [100, 50] },
    });
};

describe("a rectangle extent", () => {
    it("keeps a dragged node's box inside it", () => {
        const flow = bounded();
        dragOn(flow.node("n"), flow.root, [
            { clientX: 110, clientY: 110 },
            { clientX: 600, clientY: 500 },
        ]);
        expect(positionOf(flow, "n")).toEqual({ x: 200, y: 150 });
        dragOn(flow.node("n"), flow.root, [
            { clientX: 210, clientY: 160 },
            { clientX: -200, clientY: -200 },
        ]);
        expect(positionOf(flow, "n")).toEqual({ x: 0, y: 0 });
    });

    it("keeps the arrows' moves inside it", () => {
        const flow = bounded();
        flow.model.run("node.move", {
            nodeId: "n",
            position: { x: 198, y: 100 },
        });
        key(flow.node("n"), "ArrowRight");
        expect(positionOf(flow, "n")).toEqual({ x: 200, y: 100 });
        key(flow.node("n"), "ArrowRight", { shiftKey: true });
        expect(positionOf(flow, "n")).toEqual({ x: 200, y: 100 });
    });

    it("keeps a resize inside it", () => {
        const flow = bounded();
        const corner = resizeHandle(flow.node("n"), "bottom-right");
        dragOn(corner, flow.root, [
            { clientX: 200, clientY: 150 },
            { clientX: 700, clientY: 700 },
        ]);
        expect(flow.model.get("node-by", { id: "n" })).toMatchObject({
            position: { x: 100, y: 100 },
            width: 200,
            height: 100,
        });
        const start = resizeHandle(flow.node("n"), "top-left");
        dragOn(start, flow.root, [
            { clientX: 100, clientY: 100 },
            { clientX: -50, clientY: -50 },
        ]);
        expect(flow.model.get("node-by", { id: "n" })).toMatchObject({
            position: { x: 0, y: 0 },
            width: 300,
            height: 200,
        });
    });

    it("is relative to a child's parent", () => {
        const flow = mount(
            {
                version: 1,
                nodes: [
                    {
                        id: "p",
                        type: "group",
                        position: { x: 100, y: 100 },
                        data: {},
                    },
                    {
                        id: "c",
                        type: "default",
                        position: { x: 10, y: 10 },
                        parentId: "p",
                        extent: { x: 0, y: 0, width: 100, height: 100 },
                        data: {},
                    },
                ],
                edges: [],
            },
            {
                features: [subflows(), drag()],
                sizes: { p: [300, 300], c: [50, 50] },
            },
        );
        dragOn(flow.node("c"), flow.root, [
            { clientX: 120, clientY: 120 },
            { clientX: 700, clientY: 700 },
        ]);
        expect(positionOf(flow, "c")).toEqual({ x: 50, y: 50 });
    });

    it("bounds the box, whatever the node origin", () => {
        const json = flowOf({ n: [150, 125] });
        json.nodes[0] = {
            ...json.nodes[0],
            extent: BOX,
        } as (typeof json.nodes)[0];
        const flow = mount(json, {
            features: [subflows(), drag()],
            sizes: { n: [100, 50] },
            engine: { nodeOrigin: { x: 0.5, y: 0.5 } },
        });
        dragOn(flow.node("n"), flow.root, [
            { clientX: 150, clientY: 125 },
            { clientX: 700, clientY: 700 },
        ]);
        // the box's right and bottom edges on the extent's: its centre 50, 25 inside them
        expect(positionOf(flow, "n")).toEqual({ x: 250, y: 175 });
    });
});

describe("a node already outside its extent", () => {
    it("resizes to its least size there, never a negative one", () => {
        const flow = mount(flowOf({ n: [400, 100] }), {
            features: [resize({ minWidth: 20, minHeight: 20 })],
            sizes: { n: [100, 50] },
            engine: { nodeExtent: { x: 0, y: 0, width: 300, height: 200 } },
        });
        const corner = resizeHandle(flow.node("n"), "bottom-right");
        dragOn(corner, flow.root, [
            { clientX: 500, clientY: 150 },
            { clientX: 520, clientY: 160 },
        ]);
        const node = flow.model.get("node-by", { id: "n" });
        expect(node?.width).toBe(20);
        expect(node?.height).toBe(60);
    });
});

describe("nodeExtent", () => {
    it("bounds every node's drag, arrows and resize, with or without its own extent", () => {
        const flow = mount(flowOf({ a: [10, 10], b: [200, 100] }), {
            features: [drag(), keyboard(), resize()],
            sizes: { a: [100, 50], b: [100, 50] },
            engine: { nodeExtent: { x: 0, y: 0, width: 400, height: 300 } },
        });
        dragOn(flow.node("a"), flow.root, [
            { clientX: 20, clientY: 20 },
            { clientX: -100, clientY: -100 },
        ]);
        expect(positionOf(flow, "a")).toEqual({ x: 0, y: 0 });
        key(flow.node("a"), "ArrowLeft");
        expect(positionOf(flow, "a")).toEqual({ x: 0, y: 0 });
        const corner = resizeHandle(flow.node("b"), "bottom-right");
        dragOn(corner, flow.root, [
            { clientX: 300, clientY: 150 },
            { clientX: 700, clientY: 700 },
        ]);
        expect(flow.model.get("node-by", { id: "b" })).toMatchObject({
            width: 200,
            height: 200,
        });
        // set later, it bounds from then on
        flow.engine.adapter.setOptions({
            nodeExtent: { x: 0, y: 0, width: 150, height: 100 },
        });
        dragOn(flow.node("a"), flow.root, [
            { clientX: 20, clientY: 20 },
            { clientX: 400, clientY: 400 },
        ]);
        expect(positionOf(flow, "a")).toEqual({ x: 50, y: 50 });
    });
});

describe("the extent's schema", () => {
    const withExtent = (extent: unknown) => {
        const json = flowOf({ n: [0, 0] }) as {
            nodes: Record<string, unknown>[];
        };
        json.nodes[0] = { ...json.nodes[0], extent };
        return validateFlow(json, { features: [subflows()] });
    };

    it("takes a parent's box or a rectangle", () => {
        expect(withExtent("parent")).toEqual([]);
        expect(withExtent({ x: -10, y: 0, width: 300, height: 200 })).toEqual(
            [],
        );
    });

    it("refuses anything else", () => {
        for (const extent of [
            "child",
            { x: 0, y: 0, width: 300 },
            { x: 0, y: 0, width: -1, height: 10 },
            { x: 0, y: 0, width: 10, height: 10, z: 1 },
            [0, 0, 10, 10],
        ]) {
            expect(withExtent(extent)).not.toEqual([]);
            expect(withExtent(extent)[0]?.path).toMatch(/^\/nodes\/0\/extent/);
        }
    });

    it("is the subflows feature's field", () => {
        const json = flowOf({ n: [0, 0] }) as {
            nodes: Record<string, unknown>[];
        };
        json.nodes[0] = { ...json.nodes[0], extent: BOX };
        expect(validateFlow(json)).toMatchObject([{ path: "/nodes/0/extent" }]);
    });
});
