// @vitest-environment jsdom
// The selection feature's engine side: taps select, modifiers toggle, a tap on the pane clears,
// and a Shift + drag on the pane draws a selection box (full or partial), transient until released.
import { afterEach, describe, expect, it } from "vitest";
import { selection } from "../../src/selection/selection";
import {
    drag as dragOn,
    flowOf,
    key,
    mount,
    pointer,
    unmountAll,
} from "../engine/harness";

afterEach(unmountAll);

const json = flowOf(
    { a: [0, 0], b: [200, 0], c: [400, 0] },
    {
        edges: [
            { id: "ab", source: "a", target: "b" },
            { id: "bc", source: "b", target: "c" },
        ],
    },
);
const sizes = { a: [100, 50], b: [100, 50], c: [100, 50] } as Record<
    string,
    [number, number]
>;

const tap = (target: Element, init: PointerEventInit = {}) => {
    pointer(target, "pointerdown", { clientX: 1, clientY: 1, ...init });
    pointer(target, "pointerup", { clientX: 2, clientY: 1, ...init });
};

describe("selecting by taps", () => {
    it("selects a node or an edge, toggles with a modifier, clears on the pane", () => {
        const { model, node, edge, root } = mount(json, {
            features: [selection()],
            sizes,
        });
        const selected = () => [
            ...model.get("selected-nodes").map((n) => n.id),
            ...model.get("selected-edges").map((e) => e.id),
        ];
        tap(node("a"));
        expect(selected()).toEqual(["a"]);
        tap(node("b"), { shiftKey: true });
        expect(selected()).toEqual(["a", "b"]);
        tap(node("a"), { metaKey: true });
        expect(selected()).toEqual(["b"]);
        tap(edge("ab"));
        expect(selected()).toEqual(["ab"]);
        tap(edge("bc"), { ctrlKey: true });
        expect(selected()).toEqual(["ab", "bc"]);
        tap(root);
        expect(selected()).toEqual([]);
    });

    it("replaces without `multiple`, and skips what is not selectable", () => {
        const flow = flowOf({ a: [0, 0], b: [200, 0] });
        flow.nodes[1] = {
            ...flow.nodes[1],
            selectable: false,
        } as (typeof flow.nodes)[1];
        const { model, node } = mount(flow, {
            features: [selection({ multiple: false })],
            sizes,
        });
        tap(node("a"));
        tap(node("a"), { shiftKey: true });
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["a"]);
        tap(node("b"));
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["a"]);
    });

    it("is no tap when the press moved, and nothing when the flow is locked", () => {
        const { model, node, root, engine } = mount(json, {
            features: [selection()],
            sizes,
        });
        dragOn(node("a"), root, [
            { clientX: 10, clientY: 10 },
            { clientX: 30, clientY: 10 },
        ]);
        expect(model.get("selected-nodes")).toEqual([]);
        engine.run("set-interactive", { interactive: false });
        tap(node("a"));
        expect(model.get("selected-nodes")).toEqual([]);
    });
});

describe("the selection box", () => {
    it("selects the nodes it holds whole, with the edges between them", () => {
        const { model, root, engine, commits, events } = mount(json, {
            features: [selection()],
            sizes,
        });
        pointer(root, "pointerdown", {
            clientX: -10,
            clientY: -10,
            shiftKey: true,
        });
        pointer(root, "pointermove", {
            clientX: 250,
            clientY: 60,
            shiftKey: true,
        });
        expect(engine.is("box-selecting")).toBe(true);
        expect(engine.get("selection-box")).toEqual({
            x: -10,
            y: -10,
            width: 260,
            height: 70,
        });
        // b is cut by the box: only a
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["a"]);
        pointer(root, "pointermove", {
            clientX: 310,
            clientY: 60,
            shiftKey: true,
        });
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual([
            "a",
            "b",
        ]);
        expect(model.get("selected-edges").map((e) => e.id)).toEqual(["ab"]);
        expect(
            engine.adapter.attributes("selection-box")["data-selecting"],
        ).toBe("");
        pointer(root, "pointerup", { clientX: 310, clientY: 60 });
        expect(engine.get("selection-box")).toBeNull();
        expect(commits.map((c) => [c.command, c.transient])).toEqual([
            ["selection.set", true],
            ["selection.set", true],
            ["selection.set", false],
        ]);
        expect(events.at(-1)).toEqual({
            type: "box-select",
            nodeIds: ["a", "b"],
            edgeIds: ["ab"],
        });
        // the viewport did not pan
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });

    it("takes the nodes it touches in partial mode, and any drag with boxOnDrag", () => {
        const { model, root } = mount(json, {
            features: [selection({ boxMode: "partial", boxOnDrag: true })],
            sizes,
        });
        dragOn(root, root, [
            { clientX: 150, clientY: 60 },
            { clientX: 250, clientY: 40 },
        ]);
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["b"]);
    });

    it("puts the selection back when cancelled", () => {
        const { model, root } = mount(json, { features: [selection()], sizes });
        model.run("selection.set", { nodeIds: ["c"] });
        pointer(root, "pointerdown", {
            clientX: -10,
            clientY: -10,
            shiftKey: true,
        });
        pointer(root, "pointermove", {
            clientX: 120,
            clientY: 60,
            shiftKey: true,
        });
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["a"]);
        key(root, "Escape");
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["c"]);
    });
});
