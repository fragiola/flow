import { createFlowModel, type FlowJson } from "@fragiola/flow-react";
import { describe, expect, it } from "vitest";
import {
    guidesOf,
    linesOf,
    sameGuides,
    snapBox,
    snapOffset,
} from "../src/examples/helper-lines/alignment";
import {
    boxOf,
    othersOf,
    snapToLines,
} from "../src/examples/helper-lines/snapping";

// The helper-lines example: where a moving box lines up with the others (its snap and its guides),
// and the middleware that snaps a drag's moves (transient steps and the drop) but no other move.

const box = (x: number, y: number, width = 100, height = 40) => ({
    x,
    y,
    width,
    height,
});

describe("linesOf", () => {
    it("is a box's start, centre and end on an axis", () => {
        expect(linesOf(box(10, 20), "x")).toEqual([10, 60, 110]);
        expect(linesOf(box(10, 20), "y")).toEqual([20, 40, 60]);
    });
});

describe("snapOffset and snapBox", () => {
    const other = box(0, 0, 160, 60);

    it("moves a line within the threshold onto the other's, the nearest pair winning", () => {
        // left 3 → 0
        expect(snapOffset(box(3, 200), [other], "x", 8)).toBe(-3);
        // right 165 → 160 (the left, 65, is 15 from the centre 80)
        expect(snapOffset(box(65, 200), [other], "x", 8)).toBe(-5);
        // centres: 34 → 30
        expect(snapOffset(box(300, 14), [other], "y", 8)).toBe(-4);
    });

    it("leaves an axis alone when nothing is near enough", () => {
        expect(snapOffset(box(20, 200), [other], "x", 8)).toBe(0);
        expect(snapOffset(box(20, 200), [], "x", 8)).toBe(0);
    });

    it("snaps each axis on its own", () => {
        expect(snapBox(box(3, 14), [other], 8)).toEqual({ x: 0, y: 10 });
        expect(snapBox(box(3, 500), [other], 8)).toEqual({ x: 0, y: 500 });
    });
});

describe("guidesOf", () => {
    it("draws a line where a box lines up, spanning both boxes", () => {
        expect(guidesOf(box(0, 200), [box(0, 0, 160, 60)])).toEqual([
            { axis: "x", at: 0, from: 0, to: 240 },
        ]);
        expect(guidesOf(box(300, 10), [box(0, 0, 160, 60)])).toEqual([
            { axis: "y", at: 30, from: 0, to: 400 },
        ]);
    });

    it("merges the boxes on one line into one guide, sorted by axis then place", () => {
        const guides = guidesOf(box(0, 0), [
            box(0, 100),
            box(-50, 300, 100, 40),
            box(500, 0),
        ]);
        expect(guides).toEqual([
            // left 0 with the first, centre 50 with the second's right, right 100 with the first's
            { axis: "x", at: 0, from: 0, to: 340 },
            { axis: "x", at: 50, from: 0, to: 340 },
            { axis: "x", at: 100, from: 0, to: 140 },
            { axis: "y", at: 0, from: 0, to: 600 },
            { axis: "y", at: 20, from: 0, to: 600 },
            { axis: "y", at: 40, from: 0, to: 600 },
        ]);
    });

    it("draws nothing when nothing lines up", () => {
        expect(guidesOf(box(7, 7), [box(200, 200, 30, 30)])).toEqual([]);
    });
});

describe("sameGuides", () => {
    it("compares two lists by value", () => {
        const a = guidesOf(box(0, 200), [box(0, 0)]);
        expect(sameGuides(a, guidesOf(box(0, 200), [box(0, 0)]))).toBe(true);
        expect(sameGuides(a, [])).toBe(false);
        expect(sameGuides(a, guidesOf(box(0, 300), [box(0, 0)]))).toBe(false);
    });
});

describe("boxOf and othersOf", () => {
    it("reads a node's box from the document, and skips the node itself, children and sizeless nodes", () => {
        const nodes = [
            {
                id: "a",
                type: "t",
                position: { x: 1, y: 2 },
                width: 10,
                height: 20,
                data: {},
            },
            {
                id: "b",
                type: "t",
                position: { x: 5, y: 5 },
                initialWidth: 30,
                initialHeight: 40,
                data: {},
            },
            { id: "c", type: "t", position: { x: 0, y: 0 }, data: {} },
            {
                id: "d",
                type: "t",
                position: { x: 0, y: 0 },
                width: 10,
                height: 10,
                parentId: "a",
                data: {},
            },
        ];
        expect(boxOf(nodes[0] as never)).toEqual(box(1, 2, 10, 20));
        expect(othersOf(nodes as never, "a")).toEqual([box(5, 5, 30, 40)]);
    });
});

describe("snapToLines", () => {
    const json: FlowJson = {
        version: 1,
        nodes: [
            {
                id: "a",
                type: "t",
                position: { x: 0, y: 0 },
                width: 160,
                height: 60,
                data: {},
            },
            {
                id: "b",
                type: "t",
                position: { x: 36, y: 250 },
                width: 180,
                height: 60,
                data: {},
            },
        ],
        edges: [],
    };
    const made = () => {
        const model = createFlowModel(json);
        model.use(snapToLines(8));
        return model;
    };
    const at = (model: ReturnType<typeof made>, id: string) =>
        model.get("node-by", { id })?.position;
    const move = (x: number, y: number) => ({
        nodeId: "b",
        position: { x, y },
    });

    it("snaps a drag's steps and its drop", () => {
        const model = made();
        model.run("node.move", move(20, 250), { transient: true });
        expect(at(model, "b")).toEqual({ x: 20, y: 250 });
        model.run("node.move", move(3, 250), { transient: true });
        expect(at(model, "b")).toEqual({ x: 0, y: 250 });
        model.run("node.move", move(4, 250));
        expect(at(model, "b")).toEqual({ x: 0, y: 250 });
    });

    it("leaves a move that is no drag's as it is", () => {
        const model = made();
        model.run("node.move", move(3, 250));
        expect(at(model, "b")).toEqual({ x: 3, y: 250 });
    });

    it("puts a cancelled drag back where it began, unsnapped", () => {
        const model = made();
        model.run("node.move", move(3, 250), { transient: true });
        expect(at(model, "b")).toEqual({ x: 0, y: 250 });
        // Escape: the drag's start, as it was
        model.run("node.move", move(36, 250));
        expect(at(model, "b")).toEqual({ x: 36, y: 250 });
        // and the next move without a drag is not snapped
        model.run("node.move", move(3, 250));
        expect(at(model, "b")).toEqual({ x: 3, y: 250 });
    });

    it("does not snap the moves of a batch (a selection dragged together)", () => {
        const model = made();
        model.run(
            "batch",
            { commands: [{ command: "node.move", payload: move(3, 250) }] },
            { transient: true },
        );
        expect(at(model, "b")).toEqual({ x: 3, y: 250 });
    });
});
