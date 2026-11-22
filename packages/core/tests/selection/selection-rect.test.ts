// @vitest-environment jsdom
// The rectangle around the selected nodes (`selection-rect`, the `nodes-selection` part): its
// bounds after a box (or always, `rect: "always"`), gone when the selection changes otherwise; a
// press on it drags the selection as a node drag (threshold, snap, extent, auto-pan), told as
// `selection-drag-start`, `selection-drag`, `selection-drag-end`; its context menu is the
// selection's.
import { afterEach, describe, expect, it } from "vitest";
import { drag } from "../../src/drag/drag";
import type { FlowEngineEvent } from "../../src/engine/events";
import type { FlowFeatures } from "../../src/features/types";
import { selection } from "../../src/selection/selection";
import {
    flowOf,
    installFrames,
    key,
    type Mounted,
    type MountOptions,
    mount,
    pointer,
    unmountAll,
} from "../engine/harness";

afterEach(unmountAll);

const json = () => flowOf({ p: [40, 30], q: [240, 90], r: [600, 400] });
const sizes = { p: [80, 40], q: [60, 30], r: [50, 50] } as Record<
    string,
    [number, number]
>;

/** p and q's bounds as they start. */
const PQ = { x: 40, y: 30, width: 260, height: 90 };

/** Mounts the flow with a `nodes-selection` element in its viewport. */
function mountWithRect<const F extends FlowFeatures>(
    options: MountOptions<F>,
    flow = json(),
): Mounted<F> & { rect: HTMLElement } {
    const mounted = mount(flow, { sizes, ...options });
    const rect = document.createElement("div");
    rect.setAttribute("data-flow-part", "nodes-selection");
    mounted.viewport.append(rect);
    return Object.assign(mounted, { rect });
}

/** A Shift + drag on the pane around p and q. */
function boxAroundPQ(root: HTMLElement): void {
    pointer(root, "pointerdown", { clientX: 20, clientY: 10, shiftKey: true });
    pointer(root, "pointermove", {
        clientX: 320,
        clientY: 140,
        shiftKey: true,
    });
    pointer(root, "pointerup", { clientX: 320, clientY: 140, shiftKey: true });
}

const positionOf = (flow: Mounted<FlowFeatures>, id: string) =>
    (flow.model.get("node-by", { id }) as { position: unknown }).position;

const without = (events: FlowEngineEvent[], type: string) =>
    events.filter((event) => event.type !== type);

describe("the selection-rect read", () => {
    it("bounds two or more nodes a box selected, and is null while the box is drawn", () => {
        const { engine, root } = mountWithRect({ features: [selection()] });
        expect(engine.get("selection-rect")).toBeNull();
        pointer(root, "pointerdown", {
            clientX: 20,
            clientY: 10,
            shiftKey: true,
        });
        pointer(root, "pointermove", {
            clientX: 320,
            clientY: 140,
            shiftKey: true,
        });
        expect(engine.get("selection-rect")).toBeNull();
        pointer(root, "pointerup", { clientX: 320, clientY: 140 });
        expect(engine.get("selection-rect")).toEqual(PQ);
    });

    it("is null when a box selects a single node", () => {
        const { engine, root } = mountWithRect({ features: [selection()] });
        pointer(root, "pointerdown", {
            clientX: 20,
            clientY: 10,
            shiftKey: true,
        });
        pointer(root, "pointermove", {
            clientX: 150,
            clientY: 90,
            shiftKey: true,
        });
        pointer(root, "pointerup", { clientX: 150, clientY: 90 });
        expect(engine.get("selection-rect")).toBeNull();
    });

    it("clears when the selection changes otherwise, and does not come back with it", () => {
        const { engine, model, root, node } = mountWithRect({
            features: [selection()],
        });
        boxAroundPQ(root);
        expect(engine.get("selection-rect")).toEqual(PQ);
        // a click selects one node
        pointer(node("p"), "pointerdown", { clientX: 50, clientY: 40 });
        pointer(root, "pointerup", { clientX: 50, clientY: 40 });
        expect(model.get("selected-nodes").map((n) => n.id)).toEqual(["p"]);
        expect(engine.get("selection-rect")).toBeNull();
        // the same nodes selected again, not by a box: no rectangle
        model.run("selection.set", { nodeIds: ["p", "q"] });
        expect(engine.get("selection-rect")).toBeNull();
        boxAroundPQ(root);
        expect(engine.get("selection-rect")).toEqual(PQ);
        model.run("selection.set", { nodeIds: ["r"], mode: "add" });
        expect(engine.get("selection-rect")).toBeNull();
    });

    it("follows the nodes' positions and measurements", () => {
        const flow = mountWithRect({ features: [selection()] });
        boxAroundPQ(flow.root);
        flow.model.run("node.move", {
            nodeId: "q",
            position: { x: 300, y: 100 },
        });
        expect(flow.engine.get("selection-rect")).toEqual({
            x: 40,
            y: 30,
            width: 320,
            height: 100,
        });
        flow.sizes.set("p", [100, 120]);
        flow.observer()?.trigger([flow.node("p")]);
        expect(flow.engine.get("selection-rect")).toEqual({
            x: 40,
            y: 30,
            width: 320,
            height: 120,
        });
    });

    it('shows whenever two or more nodes are selected with rect: "always"', () => {
        const { engine, model } = mountWithRect({
            features: [selection({ rect: "always" })],
        });
        model.run("selection.set", { nodeIds: ["p"] });
        expect(engine.get("selection-rect")).toBeNull();
        model.run("selection.set", { nodeIds: ["p", "q"] });
        expect(engine.get("selection-rect")).toEqual(PQ);
        model.run("selection.clear", {});
        expect(engine.get("selection-rect")).toBeNull();
    });

    it("leaves out hidden and unmeasured nodes", () => {
        const flow = json();
        flow.nodes[1] = {
            ...flow.nodes[1],
            hidden: true,
        } as (typeof flow.nodes)[1];
        const { engine, model } = mountWithRect(
            {
                features: [selection({ rect: "always" })],
                sizes: { p: [80, 40], q: [60, 30] },
            },
            flow,
        );
        model.run("selection.set", { nodeIds: ["p", "q", "r"] });
        expect(engine.get("selection-rect")).toEqual({
            x: 40,
            y: 30,
            width: 80,
            height: 40,
        });
    });
});

describe("dragging the rectangle", () => {
    it("moves every selected node past the threshold, told once per step", () => {
        const flow = mountWithRect({
            features: [selection(), drag({ threshold: 5 })],
        });
        boxAroundPQ(flow.root);
        flow.commits.length = 0;
        flow.events.length = 0;
        pointer(flow.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(flow.root, "pointermove", { clientX: 103, clientY: 50 });
        expect(flow.commits).toHaveLength(0);
        pointer(flow.root, "pointermove", { clientX: 120, clientY: 50 });
        expect(flow.engine.get("dragging-node-ids")).toEqual(["p", "q"]);
        expect(
            flow.engine.adapter.attributes("nodes-selection")["data-dragging"],
        ).toBe("");
        pointer(flow.root, "pointermove", { clientX: 130, clientY: 70 });
        pointer(flow.root, "pointerup", { clientX: 130, clientY: 70 });
        expect(positionOf(flow, "p")).toEqual({ x: 70, y: 50 });
        expect(positionOf(flow, "q")).toEqual({ x: 270, y: 110 });
        expect(positionOf(flow, "r")).toEqual({ x: 600, y: 400 });
        expect(flow.commits.map((c) => [c.command, c.transient])).toEqual([
            ["batch", true],
            ["batch", true],
            ["batch", false],
        ]);
        expect(without(flow.events, "viewport-change")).toEqual([
            {
                type: "selection-drag-start",
                nodeIds: ["p", "q"],
                client: { x: 120, y: 50 },
                point: { x: 120, y: 50 },
            },
            {
                type: "selection-drag",
                nodeIds: ["p", "q"],
                client: { x: 120, y: 50 },
                point: { x: 120, y: 50 },
            },
            {
                type: "selection-drag",
                nodeIds: ["p", "q"],
                client: { x: 130, y: 70 },
                point: { x: 130, y: 70 },
            },
            { type: "nodes-move", nodeIds: ["p", "q"], source: "pointer" },
            {
                type: "selection-drag-end",
                nodeIds: ["p", "q"],
                client: { x: 130, y: 70 },
                point: { x: 130, y: 70 },
            },
        ]);
        expect(
            flow.engine.adapter.attributes("nodes-selection")["data-dragging"],
        ).toBeUndefined();
        // the selection is kept, the rectangle moved with it
        expect(flow.engine.get("selection-rect")).toEqual({
            ...PQ,
            x: 70,
            y: 50,
        });
    });

    it("snaps its first node to the grid, the others keeping their offsets", () => {
        const flow = mountWithRect({
            features: [selection(), drag({ snapGrid: [20, 20] })],
        });
        boxAroundPQ(flow.root);
        // 33, 14 flow units: p at 73, 44, snapped to 80, 40
        pointer(flow.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(flow.root, "pointermove", { clientX: 133, clientY: 64 });
        pointer(flow.root, "pointerup", { clientX: 133, clientY: 64 });
        expect(positionOf(flow, "p")).toEqual({ x: 80, y: 40 });
        expect(positionOf(flow, "q")).toEqual({ x: 280, y: 100 });
    });

    it("keeps every node inside the engine's nodeExtent", () => {
        const flow = mountWithRect({
            features: [selection(), drag()],
            engine: { nodeExtent: { x: 0, y: 0, width: 400, height: 300 } },
        });
        boxAroundPQ(flow.root);
        pointer(flow.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(flow.root, "pointermove", { clientX: 400, clientY: 50 });
        pointer(flow.root, "pointerup", { clientX: 400, clientY: 50 });
        // 300 units right: each node stops at the extent's right side, as in a node drag
        expect(positionOf(flow, "p")).toEqual({ x: 320, y: 30 });
        expect(positionOf(flow, "q")).toEqual({ x: 340, y: 90 });
    });

    it("auto-pans near the root's edge, the nodes following the pointer", () => {
        const frames = installFrames();
        const flow = mountWithRect({ features: [selection(), drag()] });
        boxAroundPQ(flow.root);
        flow.events.length = 0;
        pointer(flow.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(flow.root, "pointermove", { clientX: 795, clientY: 50 });
        for (let i = 0; i < 3; i++) frames.frame();
        const viewport = flow.engine.get("viewport");
        expect(viewport.x).toBeLessThan(0);
        pointer(flow.root, "pointerup", { clientX: 795, clientY: 50 });
        // the pointer's flow point minus where p was grabbed (60, 20 in)
        expect(positionOf(flow, "p")).toEqual({
            x: expect.closeTo(795 - viewport.x - 60),
            y: 30,
        });
        // one step per pointer move and per auto-pan frame, one start and one end
        const types = without(flow.events, "viewport-change").map(
            (e) => e.type,
        );
        expect(types.filter((t) => t === "selection-drag-start")).toHaveLength(
            1,
        );
        expect(types.filter((t) => t === "selection-drag")).toHaveLength(4);
        expect(types.filter((t) => t === "selection-drag-end")).toHaveLength(1);
    });

    it("puts the nodes back on Escape, told as drag-cancel", () => {
        const flow = mountWithRect({ features: [selection(), drag()] });
        boxAroundPQ(flow.root);
        flow.events.length = 0;
        pointer(flow.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(flow.root, "pointermove", { clientX: 150, clientY: 50 });
        key(flow.root, "Escape");
        expect(positionOf(flow, "p")).toEqual({ x: 40, y: 30 });
        expect(positionOf(flow, "q")).toEqual({ x: 240, y: 90 });
        expect(without(flow.events, "viewport-change").at(-1)).toEqual({
            type: "drag-cancel",
            nodeIds: ["p", "q"],
        });
    });

    it("drags nothing while dragging is off, nor nodes that are not draggable", () => {
        const flow = json();
        flow.nodes[1] = {
            ...flow.nodes[1],
            draggable: false,
        } as (typeof flow.nodes)[1];
        const mounted = mountWithRect(
            { features: [selection(), drag()] },
            flow,
        );
        boxAroundPQ(mounted.root);
        mounted.engine.run("set-interactive", { drag: false });
        pointer(mounted.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(mounted.root, "pointermove", { clientX: 150, clientY: 50 });
        pointer(mounted.root, "pointerup", { clientX: 150, clientY: 50 });
        expect(positionOf(mounted, "p")).toEqual({ x: 40, y: 30 });
        mounted.engine.run("set-interactive", { drag: true });
        pointer(mounted.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(mounted.root, "pointermove", { clientX: 150, clientY: 50 });
        pointer(mounted.root, "pointerup", { clientX: 150, clientY: 50 });
        expect(positionOf(mounted, "p")).toEqual({ x: 90, y: 30 });
        expect(positionOf(mounted, "q")).toEqual({ x: 240, y: 90 });
    });

    it("is no tap: a press released in place selects nor clears nothing", () => {
        const flow = mountWithRect({ features: [selection(), drag()] });
        boxAroundPQ(flow.root);
        flow.events.length = 0;
        pointer(flow.rect, "pointerdown", { clientX: 100, clientY: 50 });
        pointer(flow.root, "pointerup", { clientX: 100, clientY: 50 });
        expect(flow.model.get("selected-nodes").map((n) => n.id)).toEqual([
            "p",
            "q",
        ]);
        expect(flow.engine.get("selection-rect")).toEqual(PQ);
        expect(without(flow.events, "viewport-change")).toEqual([]);
    });
});

describe("the rectangle's context menu", () => {
    it("is the selection's", () => {
        const flow = mountWithRect({ features: [selection(), drag()] });
        boxAroundPQ(flow.root);
        flow.events.length = 0;
        const menu = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 110,
            clientY: 60,
        });
        flow.rect.dispatchEvent(menu);
        expect(flow.events).toEqual([
            {
                type: "selection-context-menu",
                nodeIds: ["p", "q"],
                edgeIds: [],
                point: { x: 110, y: 60 },
                client: { x: 110, y: 60 },
                event: menu,
            },
        ]);
    });
});
