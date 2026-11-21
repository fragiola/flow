// @vitest-environment jsdom
// The resize feature's engine side: eight handles, min/max (the feature's and a resizer's own),
// the kept aspect ratio, a child kept inside its parent, and a parent kept around its children
// (which stay where they are on screen when its top or left edge moves).
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { resize } from "../../src/resize/resize";
import { resizedRect } from "../../src/resize/resize-engine";
import { subflows } from "../../src/subflows/subflows";
import {
    drag as dragOn,
    flowOf,
    key,
    mount,
    pointer,
    unmountAll,
} from "../engine/harness";

afterEach(unmountAll);

/** Adds a resize handle at `position` inside a node's element. */
function resizeHandle(node: HTMLElement, position: string): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-flow-part", "resize-handle");
    element.setAttribute("data-position", position);
    node.append(element);
    return element;
}

const box = (
    flow: { model: { get(key: "node-by", payload: { id: string }): unknown } },
    id: string,
) => {
    const node = flow.model.get("node-by", { id }) as {
        position: { x: number; y: number };
        width?: number;
        height?: number;
    };
    return { ...node.position, width: node.width, height: node.height };
};

const one = (options: Parameters<typeof resize>[0] = {}, json?: FlowJson) =>
    mount(json ?? flowOf({ n: [100, 100] }), {
        features: [resize({ minWidth: 20, minHeight: 20, ...options })],
        sizes: { n: [100, 50] },
    });

describe("resizing a node", () => {
    it("resizes from a corner: transient steps, then the final one", () => {
        const flow = one();
        const handle = resizeHandle(flow.node("n"), "bottom-right");
        pointer(handle, "pointerdown", { clientX: 200, clientY: 150 });
        pointer(flow.root, "pointermove", { clientX: 220, clientY: 160 });
        expect(flow.engine.is("node-resizing", { nodeId: "n" })).toBe(true);
        expect(flow.engine.is("resizing")).toBe(true);
        expect(
            flow.engine.adapter.attributes("node", { nodeId: "n" })[
                "data-resizing"
            ],
        ).toBe("");
        pointer(flow.root, "pointermove", { clientX: 230, clientY: 170 });
        pointer(flow.root, "pointerup", { clientX: 230, clientY: 170 });
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 130,
            height: 70,
        });
        expect(flow.commits.map((c) => [c.command, c.transient])).toEqual([
            ["node.resize", true],
            ["node.resize", true],
            ["node.resize", false],
        ]);
        expect(flow.events.at(-1)).toEqual({
            type: "resize",
            nodeId: "n",
            width: 130,
            height: 70,
        });
        expect(flow.engine.is("resizing")).toBe(false);
    });

    it("moves the node from a top or left edge, the opposite one staying", () => {
        const flow = one();
        dragOn(resizeHandle(flow.node("n"), "top-left"), flow.root, [
            { clientX: 100, clientY: 100 },
            { clientX: 110, clientY: 105 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 110,
            y: 105,
            width: 90,
            height: 45,
        });
    });

    it("keeps the limits, a resizer's own over the feature's", () => {
        const flow = one();
        dragOn(resizeHandle(flow.node("n"), "left"), flow.root, [
            { clientX: 100, clientY: 120 },
            { clientX: 600, clientY: 120 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 180,
            y: 100,
            width: 20,
            height: 50,
        });
        flow.engine.adapter.setPartOptions("resizer", "n", { maxWidth: 120 });
        dragOn(resizeHandle(flow.node("n"), "right"), flow.root, [
            { clientX: 200, clientY: 120 },
            { clientX: 900, clientY: 120 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 180,
            y: 100,
            width: 120,
            height: 50,
        });
    });

    it("keeps the aspect ratio", () => {
        const flow = one({ keepAspectRatio: true });
        dragOn(resizeHandle(flow.node("n"), "bottom-right"), flow.root, [
            { clientX: 200, clientY: 150 },
            { clientX: 250, clientY: 150 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 150,
            height: 75,
        });
        dragOn(resizeHandle(flow.node("n"), "top"), flow.root, [
            { clientX: 175, clientY: 100 },
            { clientX: 175, clientY: 85 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 85,
            width: 180,
            height: 90,
        });
    });

    it("divides by the zoom, and puts the node back when cancelled", () => {
        const flow = mount(flowOf({ n: [0, 0] }), {
            features: [resize()],
            sizes: { n: [100, 50] },
            engine: { defaultViewport: { x: 0, y: 0, zoom: 2 } },
        });
        const handle = resizeHandle(flow.node("n"), "right");
        pointer(handle, "pointerdown", { clientX: 200, clientY: 50 });
        pointer(flow.root, "pointermove", { clientX: 240, clientY: 50 });
        expect(box(flow, "n")).toEqual({ x: 0, y: 0, width: 120, height: 50 });
        key(flow.root, "Escape");
        expect(box(flow, "n")).toEqual({ x: 0, y: 0, width: 100, height: 50 });
        expect(flow.engine.is("resizing")).toBe(false);
    });

    it("computes a box from a position and a delta", () => {
        const limits = {
            minWidth: 10,
            minHeight: 10,
            maxWidth: 1000,
            maxHeight: 1000,
            keepAspectRatio: false,
        };
        const start = { x: 0, y: 0, width: 100, height: 100 };
        expect(
            resizedRect(start, "bottom-left", { x: 20, y: 30 }, limits),
        ).toEqual({
            x: 20,
            y: 0,
            width: 80,
            height: 130,
        });
        expect(
            resizedRect(start, "top-right", { x: -95, y: -10 }, limits),
        ).toEqual({
            x: 0,
            y: -10,
            width: 10,
            height: 110,
        });
    });
});

describe("resizing in sub-flows", () => {
    const nested = (
        child: Record<string, unknown>,
        parentSize: [number, number],
    ) => {
        const json = flowOf({ p: [100, 100], c: [50, 50] });
        json.nodes[1] = {
            ...json.nodes[1],
            parentId: "p",
            ...child,
        } as (typeof json.nodes)[1];
        return mount(json, {
            features: [subflows(), resize({ minWidth: 20, minHeight: 20 })],
            sizes: { p: parentSize, c: [40, 40] },
        });
    };

    it("keeps a child inside its parent", () => {
        const flow = nested({ extent: "parent" }, [120, 120]);
        dragOn(resizeHandle(flow.node("c"), "bottom-right"), flow.root, [
            { clientX: 190, clientY: 190 },
            { clientX: 400, clientY: 400 },
        ]);
        expect(box(flow, "c")).toEqual({ x: 50, y: 50, width: 70, height: 70 });
    });

    it("keeps a parent around its children, which stay where they are on screen", () => {
        const flow = nested({ extent: "parent" }, [200, 200]);
        dragOn(resizeHandle(flow.node("p"), "left"), flow.root, [
            { clientX: 100, clientY: 200 },
            { clientX: 200, clientY: 200 },
        ]);
        expect(box(flow, "p")).toEqual({
            x: 150,
            y: 100,
            width: 150,
            height: 200,
        });
        expect(box(flow, "c")).toMatchObject({ x: 0, y: 50 });
        expect(flow.engine.get("node-rect-by", { nodeId: "c" })).toMatchObject({
            x: 150,
            y: 150,
        });
        expect(flow.commits.at(-1)).toMatchObject({
            command: "batch",
            transient: false,
        });
        dragOn(resizeHandle(flow.node("p"), "bottom-right"), flow.root, [
            { clientX: 300, clientY: 300 },
            { clientX: 0, clientY: 0 },
        ]);
        expect(box(flow, "p")).toEqual({
            x: 150,
            y: 100,
            width: 40,
            height: 90,
        });
    });

    it("keeps the top and left edges of a parent holding a child that is not draggable", () => {
        const flow = nested({ draggable: false }, [200, 200]);
        dragOn(resizeHandle(flow.node("p"), "top-left"), flow.root, [
            { clientX: 100, clientY: 100 },
            { clientX: 130, clientY: 130 },
        ]);
        expect(box(flow, "p")).toEqual({
            x: 100,
            y: 100,
            width: 200,
            height: 200,
        });
        expect(box(flow, "c")).toMatchObject({ x: 50, y: 50 });
    });

    it("keeps the ratio when the parent's bound stops a child", () => {
        const json = flowOf({ p: [0, 0], c: [50, 50] });
        json.nodes[1] = {
            ...json.nodes[1],
            parentId: "p",
            extent: "parent",
        } as (typeof json.nodes)[1];
        const flow = mount(json, {
            features: [subflows(), resize({ keepAspectRatio: true })],
            sizes: { p: [200, 100], c: [40, 20] },
        });
        dragOn(resizeHandle(flow.node("c"), "bottom-right"), flow.root, [
            { clientX: 90, clientY: 70 },
            { clientX: 190, clientY: 70 },
        ]);
        // 140 × 70 would leave the parent: 50 tall at most, so 100 wide
        expect(box(flow, "c")).toEqual({
            x: 50,
            y: 50,
            width: 100,
            height: 50,
        });
    });
});
