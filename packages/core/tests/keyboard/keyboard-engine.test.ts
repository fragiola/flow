// @vitest-environment jsdom
// The keyboard feature's engine side: focusable nodes and edges, arrows move by a step (Shift: a
// larger one), Enter and Space select, Delete and Backspace remove, Escape clears; a node that
// takes focus is panned into view.
import { afterEach, describe, expect, it } from "vitest";
import { keyboard } from "../../src/keyboard/keyboard";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import { flowOf, key, mount, unmountAll } from "../engine/harness";

afterEach(unmountAll);

const json = () =>
    flowOf(
        { a: [0, 0], b: [200, 0] },
        { edges: [{ id: "ab", source: "a", target: "b" }] },
    );
const sizes = { a: [100, 50], b: [100, 50] } as Record<
    string,
    [number, number]
>;
const at = (
    flow: { model: { get(k: "node-by", p: { id: string }): unknown } },
    id: string,
) => (flow.model.get("node-by", { id }) as { position: unknown }).position;

describe("the keyboard", () => {
    it("makes visible nodes and edges focusable", () => {
        const hiddenJson = json();
        hiddenJson.nodes[1] = {
            ...hiddenJson.nodes[1],
            hidden: true,
        } as (typeof hiddenJson.nodes)[1];
        const { engine } = mount(hiddenJson, { features: [keyboard()], sizes });
        expect(engine.is("node-focusable", { nodeId: "a" })).toBe(true);
        expect(engine.is("node-focusable", { nodeId: "b" })).toBe(false);
        expect(engine.is("edge-focusable", { edgeId: "ab" })).toBe(true);
        expect(engine.is("node-focusable", { nodeId: "nope" })).toBe(false);
    });

    it("moves the focused node by a step, a larger one with Shift", () => {
        const flow = mount(json(), {
            features: [keyboard({ step: 5, fastStep: 20 })],
            sizes,
        });
        const event = key(flow.node("a"), "ArrowRight");
        expect(event.defaultPrevented).toBe(true);
        key(flow.node("a"), "ArrowDown", { shiftKey: true });
        expect(at(flow, "a")).toEqual({ x: 5, y: 20 });
        expect(flow.commits.map((c) => [c.command, c.transient])).toEqual([
            ["node.move", false],
            ["node.move", false],
        ]);
        expect(flow.events.at(-1)).toEqual({
            type: "nodes-move",
            nodeIds: ["a"],
            source: "keyboard",
        });
        // with a modifier the arrow is the app's
        expect(
            key(flow.node("a"), "ArrowLeft", { ctrlKey: true })
                .defaultPrevented,
        ).toBe(false);
    });

    it("moves the selection, as one step", () => {
        const flow = mount(json(), {
            features: [selection(), keyboard()],
            sizes,
        });
        flow.model.run("selection.set", { nodeIds: ["a", "b"] });
        key(flow.node("a"), "ArrowLeft");
        expect(at(flow, "a")).toEqual({ x: -5, y: 0 });
        expect(at(flow, "b")).toEqual({ x: 195, y: 0 });
        expect(flow.commits.at(-1)?.command).toBe("batch");
    });

    it("keeps a child inside its parent with the measured sizes", () => {
        const nested = flowOf({ p: [0, 0], c: [0, 0] });
        nested.nodes[1] = {
            ...nested.nodes[1],
            parentId: "p",
            extent: "parent",
        } as (typeof nested.nodes)[1];
        const flow = mount(nested, {
            features: [subflows(), keyboard()],
            sizes: { p: [100, 100], c: [90, 90] },
        });
        key(flow.node("c"), "ArrowRight", { shiftKey: true });
        expect(at(flow, "c")).toEqual({ x: 10, y: 0 });
        key(flow.node("c"), "ArrowUp");
        expect(at(flow, "c")).toEqual({ x: 10, y: 0 });
    });

    it("selects with Enter and Space, clears with Escape", () => {
        const flow = mount(json(), {
            features: [selection(), keyboard()],
            sizes,
        });
        key(flow.node("a"), "Enter");
        key(flow.node("b"), " ", { shiftKey: true });
        key(flow.edge("ab"), "Enter", { metaKey: true });
        expect(flow.model.get("selected-nodes").map((n) => n.id)).toEqual([
            "a",
            "b",
        ]);
        expect(flow.model.get("selected-edges").map((e) => e.id)).toEqual([
            "ab",
        ]);
        expect(key(flow.node("a"), "Escape").defaultPrevented).toBe(true);
        expect(flow.model.get("selected-nodes")).toEqual([]);
        expect(key(flow.node("a"), "Escape").defaultPrevented).toBe(false);
    });

    it("removes the selection with Delete or Backspace", () => {
        const flow = mount(json(), {
            features: [selection(), keyboard()],
            sizes,
        });
        flow.model.run("selection.set", { nodeIds: ["a"] });
        key(flow.node("b"), "Delete");
        expect(flow.model.get("all-nodes").map((n) => n.id)).toEqual(["b"]);
        expect(flow.events.at(-1)).toEqual({
            type: "remove",
            nodeIds: ["a"],
            edgeIds: ["ab"],
        });
        expect(key(flow.node("b"), "Backspace").defaultPrevented).toBe(false);
    });

    it("removes the focused node or edge without the selection feature", () => {
        const flow = mount(json(), { features: [keyboard()], sizes });
        key(flow.edge("ab"), "Backspace");
        expect(flow.model.get("all-edges")).toEqual([]);
        key(flow.node("a"), "Delete");
        expect(flow.model.get("all-nodes").map((n) => n.id)).toEqual(["b"]);
    });

    it("leaves a field's keys and a locked flow alone", () => {
        const flow = mount(json(), { features: [keyboard()], sizes });
        const input = document.createElement("input");
        flow.node("a").append(input);
        expect(key(input, "Backspace").defaultPrevented).toBe(false);
        expect(key(input, "ArrowRight").defaultPrevented).toBe(false);
        flow.engine.run("set-interactive", { interactive: false });
        key(flow.node("a"), "ArrowRight");
        expect(flow.commits).toEqual([]);
    });

    it("pans a node that takes focus into view", () => {
        const flow = mount(flowOf({ a: [0, 0], far: [2000, 0] }), {
            features: [keyboard()],
            sizes: { a: [100, 50], far: [100, 50] },
        });
        flow.node("a").focus();
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        flow.node("far").focus();
        expect(flow.engine.get("viewport")).toEqual({
            x: -1650,
            y: 275,
            zoom: 1,
        });
    });
});
