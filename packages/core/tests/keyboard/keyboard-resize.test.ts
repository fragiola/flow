// @vitest-environment jsdom
// Keyboard resizing (`keyboard()` with `resize()`, through the host's keyboard links): focusable
// resize handles, the arrows moving a focused handle's sides by `step` / `fastStep` in one final
// `node.resize` each, within the resizer's limits and aspect ratio, a child kept in its parent and
// a parent's children kept on screen as the pointer resize does; a `resize` event with
// `source: "keyboard"`.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import type { FlowFeatures } from "../../src/features/types";
import { keyboard } from "../../src/keyboard/keyboard";
import { resize } from "../../src/resize/resize";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import { flowOf, key, mount, unmountAll } from "../engine/harness";

afterEach(unmountAll);

/** Adds a resize handle at `position` inside a node's element. */
function resizeHandle(node: HTMLElement, position: string): HTMLElement {
    const element = document.createElement("div");
    element.setAttribute("data-flow-part", "resize-handle");
    element.setAttribute("data-position", position);
    node.append(element);
    return element;
}

type Flow = ReturnType<typeof mount>;

const box = (flow: Flow, id: string) => {
    const node = flow.model.get("node-by", { id });
    return {
        ...node?.position,
        width: node?.width,
        height: node?.height,
    };
};

function one<const F extends FlowFeatures>(features: F, json?: FlowJson) {
    return mount(json ?? flowOf({ n: [100, 100] }), {
        features,
        sizes: { n: [100, 50] },
    }) as unknown as Flow;
}

describe("keyboard resizing", () => {
    it("the arrows move a focused handle's sides by step, Shift by fastStep, one final step each", () => {
        const flow = one([resize(), keyboard({ step: 4, fastStep: 30 })]);
        const right = resizeHandle(flow.node("n"), "bottom-right");
        const pressed = key(right, "ArrowRight");
        expect(pressed.defaultPrevented).toBe(true);
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 104,
            height: 50,
        });
        key(right, "ArrowDown", { shiftKey: true });
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 104,
            height: 80,
        });
        expect(flow.commits.map((c) => [c.command, c.transient])).toEqual([
            ["node.resize", false],
            ["node.resize", false],
        ]);
        expect(flow.events.at(-1)).toEqual({
            type: "resize",
            nodeId: "n",
            width: 104,
            height: 80,
            source: "keyboard",
        });
        // the node itself did not move: the arrows were the handle's
        expect(flow.events.some((e) => e.type === "nodes-move")).toBe(false);
    });

    it("a top or left side moves the node, the opposite one staying", () => {
        const flow = one([resize(), keyboard()]);
        const left = resizeHandle(flow.node("n"), "left");
        key(left, "ArrowLeft");
        expect(box(flow, "n")).toEqual({
            x: 95,
            y: 100,
            width: 105,
            height: 50,
        });
        const top = resizeHandle(flow.node("n"), "top");
        key(top, "ArrowDown");
        expect(box(flow, "n")).toEqual({
            x: 95,
            y: 105,
            width: 105,
            height: 45,
        });
    });

    it("an arrow across a side's handle is not the resizer's", () => {
        const flow = one([selection(), resize(), keyboard()]);
        const right = resizeHandle(flow.node("n"), "right");
        const up = key(right, "ArrowUp");
        expect(up.defaultPrevented).toBe(false);
        expect(flow.commits).toEqual([]);
        expect(key(right, "ArrowUp", { ctrlKey: true }).defaultPrevented).toBe(
            false,
        );
    });

    it("keeps the limits, a resizer's own over the feature's, and takes the key at a limit", () => {
        const flow = one([
            resize({ minWidth: 90, maxHeight: 60 }),
            keyboard({ fastStep: 20 }),
        ]);
        const corner = resizeHandle(flow.node("n"), "bottom-right");
        key(corner, "ArrowLeft", { shiftKey: true });
        expect(box(flow, "n")).toMatchObject({ width: 90 });
        const commits = flow.commits.length;
        const stuck = key(corner, "ArrowLeft");
        expect(stuck.defaultPrevented).toBe(true);
        expect(flow.commits).toHaveLength(commits);
        key(corner, "ArrowDown", { shiftKey: true });
        expect(box(flow, "n")).toMatchObject({ width: 90, height: 60 });
        flow.engine.adapter.setPartOptions("resizer", "n", { maxWidth: 95 });
        key(corner, "ArrowRight", { shiftKey: true });
        expect(box(flow, "n")).toMatchObject({ width: 95 });
    });

    it("keeps the aspect ratio: a side drives the other dimension", () => {
        const flow = one([resize({ keepAspectRatio: true }), keyboard()]);
        const right = resizeHandle(flow.node("n"), "right");
        key(right, "ArrowRight", { shiftKey: true });
        expect(box(flow, "n")).toEqual({
            x: 100,
            y: 100,
            width: 120,
            height: 60,
        });
        const corner = resizeHandle(flow.node("n"), "top-left");
        key(corner, "ArrowUp");
        // the larger change: 5 / 60 of the height over 0 of the width
        expect(box(flow, "n")).toMatchObject({ width: 130, height: 65 });
        expect(box(flow, "n")).toMatchObject({ x: 90, y: 95 });
    });

    it("is refused while not interactive", () => {
        const flow = one([resize(), keyboard()]);
        flow.engine.run("set-interactive", { interactive: false });
        key(resizeHandle(flow.node("n"), "right"), "ArrowRight");
        expect(flow.commits).toEqual([]);
    });
});

describe("keyboard resizing in sub-flows", () => {
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
            features: [
                subflows(),
                resize({ minWidth: 20, minHeight: 20 }),
                keyboard({ fastStep: 100 }),
            ],
            sizes: { p: parentSize, c: [40, 40] },
        }) as unknown as Flow;
    };

    it("keeps a child inside its parent", () => {
        const flow = nested({ extent: "parent" }, [120, 120]);
        key(resizeHandle(flow.node("c"), "bottom-right"), "ArrowRight", {
            shiftKey: true,
        });
        expect(box(flow, "c")).toEqual({ x: 50, y: 50, width: 70, height: 40 });
    });

    it("keeps a parent's children where they are on screen when its left side moves", () => {
        const flow = nested({ extent: "parent" }, [200, 200]);
        const left = resizeHandle(flow.node("p"), "left");
        key(left, "ArrowRight", { shiftKey: true });
        // the left side stops at the child (50 in): the parent grows no smaller past it
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
    });

    it("keeps the top and left sides of a parent holding a child that is not draggable", () => {
        const flow = nested({ draggable: false }, [200, 200]);
        const pressed = key(
            resizeHandle(flow.node("p"), "top-left"),
            "ArrowDown",
        );
        // the top side stays: nothing changes, nothing runs, the key is still the resizer's
        expect(pressed.defaultPrevented).toBe(true);
        expect(flow.commits).toEqual([]);
        expect(box(flow, "c")).toMatchObject({ x: 50, y: 50 });
        key(resizeHandle(flow.node("p"), "bottom-right"), "ArrowDown");
        expect(box(flow, "p")).toEqual({
            x: 100,
            y: 100,
            width: 200,
            height: 205,
        });
    });
});

describe("resize handle focusability", () => {
    const tabindexOf = (flow: Flow) =>
        flow.engine.adapter.attributes("resize-handle", {
            nodeId: "n",
            position: "right",
        }).tabindex;

    it("a resize handle takes focus only with both resize() and keyboard()", () => {
        expect(tabindexOf(one([resize(), keyboard()]))).toBe("0");
        expect(tabindexOf(one([keyboard(), resize()]))).toBe("0");
        expect(tabindexOf(one([resize()]))).toBeUndefined();
        expect(tabindexOf(one([keyboard()]))).toBeUndefined();
    });

    it("without resize(), the arrows on a resize handle move the selection as before", () => {
        const flow = one([selection(), keyboard()]);
        flow.model.run("selection.set", { nodeIds: ["n"] });
        key(resizeHandle(flow.node("n"), "right"), "ArrowRight");
        expect(box(flow, "n")).toMatchObject({ x: 105, y: 100 });
        expect(flow.model.get("node-by", { id: "n" })?.width).toBeUndefined();
    });
});
