// @vitest-environment jsdom
// Drag handles: a node whose element holds a `data-flow-drag-handle` element drags only from it (a
// press on its body still selects it); a node without one drags from anywhere, as before.
import { afterEach, describe, expect, it } from "vitest";
import { DRAG_HANDLE_ATTRIBUTE } from "../../src/attributes/part-attributes";
import { drag } from "../../src/drag/drag";
import { pressTargetOf } from "../../src/engine/dom";
import { selection } from "../../src/selection/selection";
import {
    drag as dragOn,
    flowOf,
    mount,
    pointer,
    unmountAll,
} from "../engine/harness";

afterEach(unmountAll);

const sizes = { a: [100, 50], b: [100, 50] } as Record<
    string,
    [number, number]
>;

/** A child element of a node, its drag handle when `handle`. */
function inside(node: HTMLElement, handle = false): HTMLElement {
    const element = document.createElement("span");
    if (handle) element.setAttribute(DRAG_HANDLE_ATTRIBUTE, "");
    node.append(element);
    return element;
}

const positionOf = (
    flow: { model: { get(key: "node-by", payload: { id: string }): unknown } },
    id: string,
) => (flow.model.get("node-by", { id }) as { position: unknown }).position;

describe("a drag handle", () => {
    it("is the attribute data-flow-drag-handle", () => {
        expect(DRAG_HANDLE_ATTRIBUTE).toBe("data-flow-drag-handle");
    });

    it("tells a press outside it from one inside it", () => {
        const flow = mount(flowOf({ a: [0, 0], b: [200, 0] }), { sizes });
        const grip = inside(inside(flow.node("a")), true);
        const label = inside(grip);
        const body = inside(flow.node("a"));
        const handles = () => undefined;
        expect(pressTargetOf(flow.root, body, handles)).toMatchObject({
            kind: "node",
            nodeId: "a",
            outsideDragHandle: true,
        });
        expect(pressTargetOf(flow.root, flow.node("a"), handles)).toMatchObject(
            { outsideDragHandle: true },
        );
        for (const target of [grip, label]) {
            expect(
                pressTargetOf(flow.root, target, handles).outsideDragHandle,
            ).toBeUndefined();
        }
        // a node without one
        expect(
            pressTargetOf(flow.root, inside(flow.node("b")), handles)
                .outsideDragHandle,
        ).toBeUndefined();
    });

    it("drags its node only from it; a press on the body still selects", () => {
        const flow = mount(flowOf({ a: [0, 0], b: [200, 0] }), {
            features: [selection(), drag()],
            sizes,
        });
        const grip = inside(flow.node("a"), true);
        const body = inside(flow.node("a"));
        dragOn(body, flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 60, clientY: 40 },
        ]);
        expect(positionOf(flow, "a")).toEqual({ x: 0, y: 0 });
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        pointer(body, "pointerdown", { clientX: 10, clientY: 10 });
        pointer(body, "pointerup", { clientX: 10, clientY: 10 });
        expect(flow.model.get("selected-nodes").map((n) => n.id)).toEqual([
            "a",
        ]);
        dragOn(grip, flow.root, [
            { clientX: 10, clientY: 10 },
            { clientX: 60, clientY: 40 },
        ]);
        expect(positionOf(flow, "a")).toEqual({ x: 50, y: 30 });
        // a node without one drags from anywhere
        dragOn(inside(flow.node("b")), flow.root, [
            { clientX: 210, clientY: 10 },
            { clientX: 230, clientY: 10 },
        ]);
        expect(positionOf(flow, "b")).toEqual({ x: 220, y: 0 });
    });
});
