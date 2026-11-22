// @vitest-environment jsdom
// The resize feature's `snap` (the moved sides land on its grid, independent of the drag
// feature's) and a resizer's `direction` (only widths and x, or only heights and y, from a corner
// handle as from a side one); a handle's own direction (`data-direction`, #40) over its resizer's.
import { afterEach, describe, expect, it } from "vitest";
import { drag } from "../../src/drag/drag";
import { keyboard } from "../../src/keyboard/keyboard";
import { resize } from "../../src/resize/resize";
import { resizedRect } from "../../src/resize/resize-engine";
import {
    drag as dragOn,
    flowOf,
    key,
    mount,
    unmountAll,
} from "../engine/harness";

afterEach(unmountAll);

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

const limits = {
    minWidth: 10,
    minHeight: 10,
    maxWidth: 1000,
    maxHeight: 1000,
    keepAspectRatio: false,
};
const start = { x: 5, y: 5, width: 100, height: 50 };

describe("resize snap", () => {
    it("puts the moved sides on the grid", () => {
        const snap = { x: 20, y: 25 };
        // the right side from 105 to 133: 140; the bottom from 55 to 67: 75
        expect(
            resizedRect(
                start,
                "bottom-right",
                { x: 28, y: 12 },
                {
                    ...limits,
                    snap,
                },
            ),
        ).toEqual({ x: 5, y: 5, width: 135, height: 70 });
        // the left side from 5 to -3: 0; the top from 5 to 18: 25
        expect(
            resizedRect(
                start,
                "top-left",
                { x: -8, y: 13 },
                {
                    ...limits,
                    snap,
                },
            ),
        ).toEqual({ x: 0, y: 25, width: 105, height: 30 });
    });

    it("snaps a pointer resize; the drag feature's snap is not the resize's", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [resize({ snap: { x: 30, y: 30 } })],
            sizes: { n: [100, 50] },
        });
        dragOn(resizeHandle(flow.node("n"), "bottom-right"), flow.root, [
            { clientX: 200, clientY: 150 },
            { clientX: 213, clientY: 159 },
        ]);
        // right 213 -> 210, bottom 159 -> 150
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 110,
            height: 50,
        });
        const unsnapped = mount(flowOf({ n: [100, 100] }), {
            features: [drag({ snapGrid: [30, 30] }), resize()],
            sizes: { n: [100, 50] },
        });
        dragOn(
            resizeHandle(unsnapped.node("n"), "bottom-right"),
            unsnapped.root,
            [
                { clientX: 200, clientY: 150 },
                { clientX: 213, clientY: 159 },
            ],
        );
        expect(box(unsnapped, "n")).toEqual({
            x: 100,
            y: 100,
            width: 113,
            height: 59,
        });
        expect(resize().options.snap).toBeUndefined();
    });
});

describe("resizer direction", () => {
    it("moves only widths and x when horizontal, only heights and y when vertical", () => {
        expect(
            resizedRect(
                start,
                "top-left",
                { x: -10, y: -10 },
                {
                    ...limits,
                    direction: "horizontal",
                },
            ),
        ).toEqual({ x: -5, y: 5, width: 110, height: 50 });
        expect(
            resizedRect(
                start,
                "bottom-right",
                { x: 10, y: 10 },
                {
                    ...limits,
                    direction: "vertical",
                },
            ),
        ).toEqual({ x: 5, y: 5, width: 100, height: 60 });
        // a side across the direction moves nothing
        expect(
            resizedRect(
                start,
                "top",
                { x: 0, y: -10 },
                {
                    ...limits,
                    direction: "horizontal",
                },
            ),
        ).toEqual(start);
        // no kept ratio: it would change the other side
        expect(
            resizedRect(
                start,
                "right",
                { x: 100, y: 0 },
                {
                    ...limits,
                    keepAspectRatio: true,
                    direction: "horizontal",
                },
            ),
        ).toEqual({ x: 5, y: 5, width: 200, height: 50 });
    });

    it("applies a resizer's own direction to corner and side handles", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [resize()],
            sizes: { n: [100, 50] },
        });
        flow.engine.adapter.setPartOptions("resizer", "n", {
            direction: "vertical",
        });
        dragOn(resizeHandle(flow.node("n"), "top-left"), flow.root, [
            { clientX: 100, clientY: 100 },
            { clientX: 80, clientY: 90 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 90,
            width: 100,
            height: 60,
        });
        dragOn(resizeHandle(flow.node("n"), "right"), flow.root, [
            { clientX: 200, clientY: 120 },
            { clientX: 240, clientY: 120 },
        ]);
        expect(box(flow, "n")).toMatchObject({ width: 100, height: 60 });
    });

    it("leaves a key across the direction to the keyboard", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [
                keyboard({ step: 4 }),
                resize({ snap: { x: 50, y: 50 } }),
            ],
            sizes: { n: [100, 50] },
        });
        flow.engine.adapter.setPartOptions("resizer", "n", {
            direction: "horizontal",
        });
        const handle = resizeHandle(flow.node("n"), "bottom-right");
        expect(key(handle, "ArrowDown").defaultPrevented).toBe(false);
        expect(flow.commits).toEqual([]);
        // a key is never snapped back
        key(handle, "ArrowRight");
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 104,
            height: 50,
        });
    });
});

describe("a handle's own direction", () => {
    const handleWith = (
        node: HTMLElement,
        position: string,
        direction: string,
    ) => {
        const element = resizeHandle(node, position);
        element.setAttribute("data-direction", direction);
        return element;
    };

    it("wins over the resizer's for a press, read when it starts", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [resize()],
            sizes: { n: [100, 50] },
        });
        flow.engine.adapter.setPartOptions("resizer", "n", {
            direction: "vertical",
        });
        // a horizontal corner on a vertical resizer moves only the width
        dragOn(
            handleWith(flow.node("n"), "bottom-right", "horizontal"),
            flow.root,
            [
                { clientX: 200, clientY: 150 },
                { clientX: 230, clientY: 170 },
            ],
        );
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 130,
            height: 50,
        });
        // a handle without one keeps the resizer's
        dragOn(resizeHandle(flow.node("n"), "bottom-right"), flow.root, [
            { clientX: 230, clientY: 150 },
            { clientX: 260, clientY: 170 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 130,
            height: 70,
        });
    });

    it("applies without a resizer direction, and an unknown value is ignored", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [resize()],
            sizes: { n: [100, 50] },
        });
        dragOn(handleWith(flow.node("n"), "top-left", "vertical"), flow.root, [
            { clientX: 100, clientY: 100 },
            { clientX: 80, clientY: 90 },
        ]);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 90,
            width: 100,
            height: 60,
        });
        dragOn(
            handleWith(flow.node("n"), "bottom-right", "diagonal"),
            flow.root,
            [
                { clientX: 200, clientY: 150 },
                { clientX: 210, clientY: 160 },
            ],
        );
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 90,
            width: 110,
            height: 70,
        });
    });

    it("wins over the resizer's for the arrows", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [keyboard({ step: 4 }), resize()],
            sizes: { n: [100, 50] },
        });
        flow.engine.adapter.setPartOptions("resizer", "n", {
            direction: "horizontal",
        });
        const handle = handleWith(flow.node("n"), "bottom-right", "vertical");
        // across the handle's own direction: not the resizer's key
        expect(key(handle, "ArrowRight").defaultPrevented).toBe(false);
        expect(flow.commits).toEqual([]);
        expect(key(handle, "ArrowDown").defaultPrevented).toBe(true);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 100,
            height: 54,
        });
    });

    it("is in the handle's record with its variant", () => {
        const flow = mount(flowOf({ n: [100, 100] }), {
            features: [resize()],
        });
        expect(
            flow.engine.adapter.attributes("resize-handle", {
                nodeId: "n",
                position: "right",
                direction: "horizontal",
                variant: "line",
            }),
        ).toEqual({
            "data-flow-part": "resize-handle",
            "data-position": "right",
            "data-variant": "line",
            "data-direction": "horizontal",
        });
    });
});
