// @vitest-environment jsdom
// The drag feature's engine side: Pointer Events with capture, the threshold, the snap grid,
// multi-node drags as transient batches with a final step, and the parent's extent with the
// measured sizes (the model alone only knows the document's).
import { afterEach, describe, expect, it } from "vitest";
import { drag } from "../../src/drag/drag";
import { selection } from "../../src/selection/selection";
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

const sizes = { a: [100, 50], b: [100, 50] } as Record<
    string,
    [number, number]
>;

const position = (
    flow: { model: { get(key: "node-by", payload: { id: string }): unknown } },
    id: string,
) => (flow.model.get("node-by", { id }) as { position: unknown }).position;

describe("dragging nodes", () => {
    it("moves a node past the threshold: transient steps, then the final one", () => {
        const flow = mount(flowOf({ a: [0, 0], b: [200, 0] }), {
            features: [selection(), drag({ threshold: 5 })],
            sizes,
        });
        const { root, node, commits, events, engine } = flow;
        pointer(node("a"), "pointerdown", { clientX: 10, clientY: 10 });
        expect(root.setPointerCapture).toHaveBeenCalledWith(1);
        pointer(root, "pointermove", { clientX: 13, clientY: 10 });
        expect(commits).toHaveLength(0);
        expect(engine.is("dragging")).toBe(false);
        pointer(root, "pointermove", { clientX: 30, clientY: 10 });
        expect(engine.is("dragging")).toBe(true);
        expect(engine.is("node-dragging", { nodeId: "a" })).toBe(true);
        expect(engine.get("dragging-node-ids")).toEqual(["a"]);
        expect(
            engine.adapter.attributes("node", { nodeId: "a" })["data-dragging"],
        ).toBe("");
        expect(engine.adapter.attributes("root")["data-dragging"]).toBe("");
        pointer(root, "pointermove", { clientX: 40, clientY: 15 });
        pointer(root, "pointerup", { clientX: 40, clientY: 15 });
        expect(position(flow, "a")).toEqual({ x: 30, y: 5 });
        expect(commits.map((c) => [c.command, c.transient])).toEqual([
            ["selection.set", false],
            ["node.move", true],
            ["node.move", true],
            ["node.move", false],
        ]);
        expect(events.filter((e) => e.type !== "viewport-change")).toEqual([
            { type: "drag-start", nodeIds: ["a"] },
            { type: "nodes-move", nodeIds: ["a"], source: "pointer" },
        ]);
        expect(engine.is("dragging")).toBe(false);
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it("snaps the pressed node to the grid, divides by the zoom", () => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [drag({ snapGrid: [25, 25] })],
            sizes,
            engine: { defaultViewport: { x: 0, y: 0, zoom: 2 } },
        });
        // 74, 24 pixels at zoom 2: 37, 12 flow units, snapped to 25, 0
        dragOn(flow.node("a"), flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 84, clientY: 34 },
        ]);
        expect(position(flow, "a")).toEqual({ x: 25, y: 0 });
    });

    it("drags the selection together, as one transient batch per step", () => {
        const flow = mount(flowOf({ a: [0, 0], b: [200, 0], c: [400, 0] }), {
            features: [selection(), drag()],
            sizes: { ...sizes, c: [100, 50] },
        });
        flow.model.run("selection.set", { nodeIds: ["a", "b"] });
        flow.commits.length = 0;
        dragOn(flow.node("a"), flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 20, clientY: 15 },
        ]);
        expect(position(flow, "a")).toEqual({ x: 10, y: 5 });
        expect(position(flow, "b")).toEqual({ x: 210, y: 5 });
        expect(position(flow, "c")).toEqual({ x: 400, y: 0 });
        expect(flow.commits.map((c) => [c.command, c.transient])).toEqual([
            ["batch", true],
            ["batch", false],
        ]);
    });

    it("selects an unselected node it drags, and drags it alone", () => {
        const flow = mount(flowOf({ a: [0, 0], b: [200, 0] }), {
            features: [selection(), drag()],
            sizes,
        });
        flow.model.run("selection.set", { nodeIds: ["b"] });
        dragOn(flow.node("a"), flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 20, clientY: 10 },
        ]);
        expect(flow.model.get("selected-nodes").map((n) => n.id)).toEqual([
            "a",
        ]);
        expect(position(flow, "b")).toEqual({ x: 200, y: 0 });
    });

    it("drags without the selection feature", () => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [drag()],
            sizes,
        });
        dragOn(flow.node("a"), flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 20, clientY: 10 },
        ]);
        expect(position(flow, "a")).toEqual({ x: 10, y: 0 });
    });

    it("leaves a node that is not draggable, a control inside a node, and a locked flow alone", () => {
        const json = flowOf({ a: [0, 0], b: [200, 0] });
        json.nodes[0] = {
            ...json.nodes[0],
            draggable: false,
        } as (typeof json.nodes)[0];
        const flow = mount(json, { features: [drag()], sizes });
        dragOn(flow.node("a"), flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 30, clientY: 10 },
        ]);
        const input = document.createElement("input");
        flow.node("b").append(input);
        dragOn(input, flow.root, [
            { clientX: 210, clientY: 10 },
            { clientX: 230, clientY: 10 },
        ]);
        flow.engine.run("set-interactive", { interactive: false });
        dragOn(flow.node("b"), flow.root, [
            { clientX: 210, clientY: 10 },
            { clientX: 230, clientY: 10 },
        ]);
        expect(flow.commits).toHaveLength(0);
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it.each([
        ["Escape", (root: HTMLElement) => key(root, "Escape")],
        [
            "pointercancel",
            (root: HTMLElement) => pointer(root, "pointercancel"),
        ],
    ])("puts the nodes back when %s cancels the drag", (_name, cancel) => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [drag()],
            sizes,
        });
        pointer(flow.node("a"), "pointerdown", { clientX: 10, clientY: 10 });
        pointer(flow.root, "pointermove", { clientX: 50, clientY: 50 });
        expect(position(flow, "a")).toEqual({ x: 40, y: 40 });
        cancel(flow.root);
        expect(position(flow, "a")).toEqual({ x: 0, y: 0 });
        expect(flow.commits.at(-1)?.transient).toBe(false);
        expect(flow.events.at(-1)).toEqual({
            type: "drag-cancel",
            nodeIds: ["a"],
        });
        expect(flow.engine.is("dragging")).toBe(false);
    });
});

describe("dragging in sub-flows", () => {
    const parentFlow = () => {
        const json = flowOf({ p: [100, 100], c: [10, 10] });
        json.nodes[1] = {
            ...json.nodes[1],
            parentId: "p",
            extent: "parent",
        } as (typeof json.nodes)[1];
        return mount(json, {
            features: [selection(), subflows(), drag()],
            sizes: { p: [200, 100], c: [50, 50] },
        });
    };

    it("keeps a child inside its parent with the measured sizes", () => {
        const flow = parentFlow();
        dragOn(flow.node("c"), flow.root, [
            { clientX: 120, clientY: 120 },
            { clientX: 620, clientY: 620 },
        ]);
        expect(position(flow, "c")).toEqual({ x: 150, y: 50 });
        dragOn(flow.node("c"), flow.root, [
            { clientX: 260, clientY: 160 },
            { clientX: -500, clientY: -500 },
        ]);
        expect(position(flow, "c")).toEqual({ x: 0, y: 0 });
    });

    it("moves a parent's children with it, a selected child carried by its parent", () => {
        const flow = parentFlow();
        flow.model.run("selection.set", { nodeIds: ["p", "c"] });
        dragOn(flow.node("p"), flow.root, [
            { clientX: 250, clientY: 180 },
            { clientX: 260, clientY: 180 },
        ]);
        expect(position(flow, "p")).toEqual({ x: 110, y: 100 });
        expect(position(flow, "c")).toEqual({ x: 10, y: 10 });
        expect(flow.engine.get("node-rect-by", { nodeId: "c" })).toEqual({
            x: 120,
            y: 110,
            width: 50,
            height: 50,
        });
    });
});
