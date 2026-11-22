// @vitest-environment jsdom
// The keyboard on the selection's rectangle (`nodes-selection`, #40): with `keyboard()` its record
// holds `tabindex="0"`, and its keys are a focused selected node's: the arrows move the whole
// selection by `step` / `fastStep` within its extents (`nodes-move { source: "keyboard" }`), the
// delete keys remove the selection, Escape clears it.
import { afterEach, describe, expect, it } from "vitest";
import { drag } from "../../src/drag/drag";
import type { FlowFeatures } from "../../src/features/types";
import { keyboard } from "../../src/keyboard/keyboard";
import { selection } from "../../src/selection/selection";
import {
    flowOf,
    key,
    type Mounted,
    type MountOptions,
    mount,
    unmountAll,
} from "../engine/harness";

afterEach(unmountAll);

const sizes = { p: [80, 40], q: [60, 30], r: [50, 50] } as Record<
    string,
    [number, number]
>;

/** Mounts p, q, r with p and q selected and a `nodes-selection` element in the viewport. */
function mountWithRect<const F extends FlowFeatures>(
    options: MountOptions<F>,
): Mounted<F> & { rect: HTMLElement } {
    const mounted = mount(
        flowOf({ p: [40, 30], q: [240, 90], r: [600, 400] }),
        { sizes, ...options },
    );
    // every flow here installs selection()
    const run = mounted.model.run as (key: string, payload: object) => unknown;
    run("selection.set", { nodeIds: ["p", "q"] });
    const rect = document.createElement("div");
    for (const [name, value] of Object.entries(
        mounted.engine.adapter.attributes("nodes-selection", {}),
    )) {
        if (value !== undefined) rect.setAttribute(name, value);
    }
    mounted.viewport.append(rect);
    return Object.assign(mounted, { rect });
}

const positionOf = (flow: Mounted<FlowFeatures>, id: string) =>
    (flow.model.get("node-by", { id }) as { position: unknown }).position;

describe("the selection's rectangle with keyboard()", () => {
    it("takes focus with keyboard(), not without it", () => {
        const flow = mountWithRect({ features: [selection(), keyboard()] });
        expect(flow.engine.adapter.attributes("nodes-selection", {})).toEqual({
            "data-flow-part": "nodes-selection",
            "data-dragging": undefined,
            tabindex: "0",
        });
        const plain = mountWithRect({ features: [selection(), drag()] });
        expect(
            plain.engine.adapter.attributes("nodes-selection", {}).tabindex,
        ).toBeUndefined();
    });

    it("moves the whole selection with the arrows, by step and fastStep, as a focused selected node does", () => {
        const flow = mountWithRect({
            features: [selection(), keyboard({ step: 5, fastStep: 20 })],
        });
        const pressed = key(flow.rect, "ArrowRight");
        expect(pressed.defaultPrevented).toBe(true);
        key(flow.rect, "ArrowDown", { shiftKey: true });
        expect(positionOf(flow, "p")).toEqual({ x: 45, y: 50 });
        expect(positionOf(flow, "q")).toEqual({ x: 245, y: 110 });
        expect(positionOf(flow, "r")).toEqual({ x: 600, y: 400 });
        expect(flow.events.filter((e) => e.type === "nodes-move")).toEqual([
            { type: "nodes-move", nodeIds: ["p", "q"], source: "keyboard" },
            { type: "nodes-move", nodeIds: ["p", "q"], source: "keyboard" },
        ]);
        // one final step a key, a batch for the two nodes
        expect(flow.commits.map((c) => [c.command, c.transient])).toEqual([
            ["selection.set", false],
            ["batch", false],
            ["batch", false],
        ]);

        // the same keys from a focused selected node give the same moves
        const fromNode = mountWithRect({
            features: [selection(), keyboard({ step: 5, fastStep: 20 })],
        });
        key(fromNode.node("p"), "ArrowRight");
        key(fromNode.node("p"), "ArrowDown", { shiftKey: true });
        expect(positionOf(fromNode, "p")).toEqual(positionOf(flow, "p"));
        expect(positionOf(fromNode, "q")).toEqual(positionOf(flow, "q"));
    });

    it("keeps the nodes inside the engine's nodeExtent", () => {
        const flow = mountWithRect({
            features: [selection(), keyboard({ step: 50 })],
            engine: { nodeExtent: { x: 0, y: 0, width: 1000, height: 1000 } },
        });
        key(flow.rect, "ArrowLeft");
        expect(positionOf(flow, "p")).toEqual({ x: 0, y: 30 });
        expect(positionOf(flow, "q")).toEqual({ x: 190, y: 90 });
    });

    it("moves nothing while dragging is off, and leaves modified arrows alone", () => {
        const flow = mountWithRect({ features: [selection(), keyboard()] });
        expect(
            key(flow.rect, "ArrowRight", { ctrlKey: true }).defaultPrevented,
        ).toBe(false);
        flow.engine.run("set-interactive", { drag: false });
        expect(key(flow.rect, "ArrowRight").defaultPrevented).toBe(false);
        expect(positionOf(flow, "p")).toEqual({ x: 40, y: 30 });
    });

    it("removes the selection with a delete key, told as remove", () => {
        const flow = mountWithRect({ features: [selection(), keyboard()] });
        expect(key(flow.rect, "Delete").defaultPrevented).toBe(true);
        expect(
            (flow.model.get("all-nodes") as readonly { id: string }[]).map(
                (n) => n.id,
            ),
        ).toEqual(["r"]);
        expect(flow.events.at(-1)).toEqual({
            type: "remove",
            nodeIds: ["p", "q"],
            edgeIds: [],
        });
    });

    it("clears the selection on Escape", () => {
        const flow = mountWithRect({ features: [selection(), keyboard()] });
        expect(key(flow.rect, "Escape").defaultPrevented).toBe(true);
        expect(flow.model.get("selected-nodes")).toEqual([]);
        // nothing selected: Escape is not the flow's
        expect(key(flow.rect, "Escape").defaultPrevented).toBe(false);
    });
});
