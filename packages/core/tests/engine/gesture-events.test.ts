// @vitest-environment jsdom
// The gesture events (#32): a viewport move's start and end (a pan, the wheel at rest, a pinch, an
// animation, an action), the taps the engine recognizes (a press released within the tap distance
// that started no gesture: a click after a drag or a pan is none), double clicks made of two taps
// (the browser's `dblclick` targets the root under capture: the target is the last press's),
// context menus (several selected nodes take the selection's), the selection box's start, a
// resize's start and cancel, and `ready`.
import { afterEach, describe, expect, it, vi } from "vitest";
import { drag } from "../../src/drag/drag";
import type { FlowEngineEvent } from "../../src/engine/events";
import { resize } from "../../src/resize/resize";
import { selection } from "../../src/selection/selection";
import {
    flowOf,
    installFrames,
    key,
    mount,
    pointer,
    unmountAll,
    wheel,
} from "./harness";

afterEach(() => {
    unmountAll();
    vi.useRealTimers();
});

const at = (clientX: number, clientY: number) => ({ clientX, clientY });

/** The events of some types, in order. */
const only = (events: FlowEngineEvent[], ...types: string[]) =>
    events.filter((event) => types.includes(event.type));

const moves = (events: FlowEngineEvent[]) =>
    only(events, "viewport-change-start", "viewport-change-end").map(
        (event) => event.type,
    );

describe("a viewport move", () => {
    it("starts on a pan's first change and ends at its release, once", () => {
        const { root, events } = mount(flowOf({}));
        pointer(root, "pointerdown", at(100, 100));
        expect(moves(events)).toEqual([]);
        pointer(root, "pointermove", at(120, 100));
        pointer(root, "pointermove", at(140, 110));
        expect(moves(events)).toEqual(["viewport-change-start"]);
        expect(only(events, "viewport-change-start")[0]).toEqual({
            type: "viewport-change-start",
            viewport: { x: 0, y: 0, zoom: 1 },
            gesture: true,
        });
        pointer(root, "pointerup", at(140, 110));
        expect(moves(events)).toEqual([
            "viewport-change-start",
            "viewport-change-end",
        ]);
        expect(events.at(-1)).toEqual({
            type: "viewport-change-end",
            viewport: { x: 40, y: 10, zoom: 1 },
            gesture: true,
        });
    });

    it("ends a cancelled pan, and a press that never moved starts none", () => {
        const { root, events } = mount(flowOf({}));
        pointer(root, "pointerdown", at(100, 100));
        pointer(root, "pointerup", at(100, 100));
        expect(moves(events)).toEqual([]);
        pointer(root, "pointerdown", at(100, 100));
        pointer(root, "pointermove", at(150, 100));
        key(root, "Escape");
        expect(moves(events)).toEqual([
            "viewport-change-start",
            "viewport-change-end",
        ]);
    });

    it("ends the wheel's move once the wheel rests", () => {
        vi.useFakeTimers();
        const { root, events } = mount(flowOf({}));
        wheel(root, { deltaY: -100, clientX: 10, clientY: 10 });
        wheel(root, { deltaY: -100, clientX: 10, clientY: 10 });
        vi.advanceTimersByTime(100);
        wheel(root, { deltaY: -100, clientX: 10, clientY: 10 });
        expect(moves(events)).toEqual(["viewport-change-start"]);
        vi.advanceTimersByTime(149);
        expect(moves(events)).toEqual(["viewport-change-start"]);
        vi.advanceTimersByTime(1);
        expect(moves(events)).toEqual([
            "viewport-change-start",
            "viewport-change-end",
        ]);
        expect(only(events, "viewport-change").length).toBe(3);
    });

    it("lasts an animation, and ends where another action stops it", () => {
        const frames = installFrames();
        const { engine, events } = mount(flowOf({}));
        engine.run("set-viewport", { x: 100, duration: 100 });
        frames.frame();
        frames.frame(50);
        expect(moves(events)).toEqual(["viewport-change-start"]);
        frames.flush();
        expect(moves(events)).toEqual([
            "viewport-change-start",
            "viewport-change-end",
        ]);
        expect(events.at(-1)).toMatchObject({
            type: "viewport-change-end",
            viewport: { x: 100 },
            gesture: false,
        });
        events.length = 0;
        engine.run("set-viewport", { x: 0, duration: 100 });
        frames.frame();
        frames.frame(30);
        engine.run("set-viewport", { y: 50 });
        // the stopped animation's move ends, the action's starts and ends
        expect(moves(events)).toEqual([
            "viewport-change-start",
            "viewport-change-end",
            "viewport-change-start",
            "viewport-change-end",
        ]);
    });

    it("lasts a pinch", () => {
        const { root, events } = mount(flowOf({}));
        const touch = (type: string, pointerId: number, clientX: number) =>
            pointer(root, type, {
                pointerId,
                pointerType: "touch",
                isPrimary: pointerId === 1,
                clientX,
                clientY: 100,
            });
        touch("pointerdown", 1, 100);
        touch("pointerdown", 2, 200);
        touch("pointermove", 2, 300);
        touch("pointermove", 2, 350);
        expect(moves(events)).toEqual(["viewport-change-start"]);
        touch("pointerup", 2, 350);
        expect(moves(events)).toEqual([
            "viewport-change-start",
            "viewport-change-end",
        ]);
    });
});

describe("taps", () => {
    const flow = () =>
        mount(
            {
                ...flowOf({ a: [0, 0], b: [300, 0] }),
                edges: [{ id: "e", source: "a", target: "b" }],
            },
            {
                features: [selection(), drag()],
                sizes: { a: [100, 50], b: [100, 50] },
            },
        );

    it("tells a tap on a node, an edge and the pane, with its points and event", () => {
        const { root, node, edge, events } = flow();
        pointer(node("a"), "pointerdown", at(10, 10));
        const up = pointer(root, "pointerup", at(12, 11));
        expect(only(events, "node-click")).toEqual([
            {
                type: "node-click",
                nodeId: "a",
                point: { x: 12, y: 11 },
                client: { x: 12, y: 11 },
                event: up,
            },
        ]);
        pointer(edge("e"), "pointerdown", at(200, 25));
        pointer(root, "pointerup", at(200, 25));
        expect(only(events, "edge-click")).toMatchObject([
            { edgeId: "e", point: { x: 200, y: 25 } },
        ]);
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointerup", at(500, 400));
        expect(only(events, "pane-click")).toMatchObject([
            { point: { x: 500, y: 400 } },
        ]);
    });

    it("tells no tap for a press that dragged a node or panned", () => {
        const { root, node, events, model } = flow();
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointermove", at(11, 10));
        pointer(root, "pointerup", at(11, 10));
        // a drag past its 1 px threshold: a drop, not a click
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 1,
            y: 0,
        });
        expect(only(events, "node-click")).toEqual([]);
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(520, 400));
        pointer(root, "pointerup", at(520, 400));
        expect(only(events, "pane-click")).toEqual([]);
    });

    it("tells taps while the flow is not interactive (they change nothing)", () => {
        const { root, node, events, engine, model } = flow();
        engine.run("set-interactive", { interactive: false });
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointerup", at(10, 10));
        expect(only(events, "node-click")).toHaveLength(1);
        expect(model.get("selected-nodes")).toEqual([]);
    });

    it("tells a double click of two taps on what they pressed, not the root", () => {
        const { root, node, events, engine } = flow();
        const tap = (target: Element, x: number, y: number) => {
            pointer(target, "pointerdown", at(x, y));
            pointer(root, "pointerup", at(x, y));
        };
        tap(node("a"), 10, 10);
        tap(node("a"), 10, 10);
        // under capture the browser's dblclick targets the root
        const dbl = new MouseEvent("dblclick", {
            bubbles: true,
            clientX: 10,
            clientY: 10,
        });
        root.dispatchEvent(dbl);
        expect(only(events, "node-double-click")).toEqual([
            {
                type: "node-double-click",
                nodeId: "a",
                point: { x: 10, y: 10 },
                client: { x: 10, y: 10 },
                event: dbl,
            },
        ]);
        expect(only(events, "node-click")).toHaveLength(2);
        // a node's double click does not zoom (only the pane's does)
        expect(engine.get("viewport").zoom).toBe(1);
        tap(root, 500, 400);
        tap(root, 500, 400);
        root.dispatchEvent(
            new MouseEvent("dblclick", {
                bubbles: true,
                clientX: 500,
                clientY: 400,
            }),
        );
        expect(only(events, "pane-double-click")).toHaveLength(1);
        expect(engine.get("viewport").zoom).toBe(2);
    });

    it("tells no double click when the last press dragged", () => {
        const { root, node, events, engine } = flow();
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointerup", at(10, 10));
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(540, 400));
        pointer(root, "pointerup", at(540, 400));
        const before = engine.get("viewport");
        root.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        expect(only(events, "pane-double-click", "node-double-click")).toEqual(
            [],
        );
        expect(engine.get("viewport")).toEqual(before);
    });

    it("leaves a double click on a control alone, after a tap on the pane", () => {
        const { root, events, engine } = flow();
        const input = document.createElement("input");
        root.append(input);
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointerup", at(500, 400));
        pointer(input, "pointerdown", at(1, 1));
        input.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
        expect(only(events, "pane-double-click")).toEqual([]);
        expect(engine.get("viewport").zoom).toBe(1);
    });

    it("takes a context menu during a press (a long press) as the press's, with no tap", () => {
        const { root, node, events, model } = flow();
        pointer(node("a"), "pointerdown", at(10, 10));
        // under capture it targets the root
        root.dispatchEvent(
            new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: 10,
                clientY: 10,
            }),
        );
        pointer(root, "pointerup", at(10, 10));
        expect(only(events, "node-context-menu")).toMatchObject([
            { nodeId: "a" },
        ]);
        expect(only(events, "pane-context-menu", "node-click")).toEqual([]);
        expect(model.get("selected-nodes")).toEqual([]);
    });

    it("tells context menus on a node, an edge, the pane and the selection", () => {
        const { root, node, edge, events, model } = flow();
        const menu = (target: Element, x: number, y: number) => {
            const event = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
            });
            target.dispatchEvent(event);
            return event;
        };
        const onNode = menu(node("a"), 5, 5);
        expect(only(events, "node-context-menu")).toEqual([
            {
                type: "node-context-menu",
                nodeId: "a",
                point: { x: 5, y: 5 },
                client: { x: 5, y: 5 },
                event: onNode,
            },
        ]);
        // the app prevents the browser's menu itself
        expect(onNode.defaultPrevented).toBe(false);
        menu(edge("e"), 200, 25);
        menu(root, 500, 500);
        expect(only(events, "edge-context-menu")).toMatchObject([
            { edgeId: "e" },
        ]);
        expect(only(events, "pane-context-menu")).toHaveLength(1);
        model.run("selection.set", { nodeIds: ["a", "b"], edgeIds: ["e"] });
        menu(node("b"), 305, 5);
        expect(only(events, "selection-context-menu")).toMatchObject([
            { nodeIds: ["a", "b"], edgeIds: ["e"] },
        ]);
        expect(only(events, "node-context-menu")).toHaveLength(1);
    });

    it("tells no context menu a right-button pan keeps out", () => {
        const { root, events } = mount(flowOf({}), {
            engine: { panOnDrag: [2] },
        });
        pointer(root, "pointerdown", { ...at(10, 10), button: 2 });
        const event = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
        });
        root.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(true);
        expect(only(events, "pane-context-menu")).toEqual([]);
    });
});

describe("the selection box and resize", () => {
    it("tells a selection box's start once, where it started", () => {
        const { root, events } = mount(flowOf({ a: [100, 100] }), {
            features: [selection({ boxOnDrag: true })],
            sizes: { a: [50, 50] },
        });
        pointer(root, "pointerdown", at(50, 60));
        expect(only(events, "box-select-start")).toEqual([]);
        pointer(root, "pointermove", at(60, 70));
        pointer(root, "pointermove", at(200, 200));
        pointer(root, "pointerup", at(200, 200));
        expect(only(events, "box-select-start", "box-select")).toEqual([
            {
                type: "box-select-start",
                client: { x: 50, y: 60 },
                point: { x: 50, y: 60 },
            },
            { type: "box-select", nodeIds: ["a"], edgeIds: [] },
        ]);
    });

    it("tells a resize's start and cancel", () => {
        const flow = mount(flowOf({ a: [0, 0] }), {
            features: [resize()],
            sizes: { a: [100, 50] },
        });
        const corner = document.createElement("div");
        corner.setAttribute("data-flow-part", "resize-handle");
        corner.setAttribute("data-position", "bottom-right");
        flow.node("a").append(corner);
        pointer(corner, "pointerdown", at(100, 50));
        pointer(flow.root, "pointermove", at(120, 60));
        pointer(flow.root, "pointermove", at(130, 70));
        key(flow.root, "Escape");
        expect(only(flow.events, "resize-start", "resize-cancel")).toEqual([
            { type: "resize-start", nodeId: "a", width: 100, height: 50 },
            { type: "resize-cancel", nodeId: "a" },
        ]);
    });
});

describe("ready", () => {
    it("comes once the root is sized, without waiting for the nodes' measurement", async () => {
        const flow = mount(flowOf({ a: [0, 0], b: [10, 10] }), {
            sizes: { a: [10, 10] },
        });
        // a reactive read (the adapters' subscription) sees it turn true
        const read: boolean[] = [];
        const stop = flow.engine.adapter.subscribe(() =>
            read.push(flow.engine.is("ready")),
        );
        expect(flow.engine.is("ready")).toBe(false);
        await Promise.resolve();
        stop();
        expect(flow.engine.is("ready")).toBe(true);
        expect(flow.engine.is("node-measured", { nodeId: "b" })).toBe(false);
        expect(read.at(-1)).toBe(true);
        expect(only(flow.events, "ready")).toEqual([{ type: "ready" }]);
        flow.sizes.set("b", [10, 10]);
        flow.observer()?.trigger([flow.node("b")]);
        await Promise.resolve();
        expect(only(flow.events, "ready")).toHaveLength(1);
    });

    it("waits for the fit on init, and so for the sizes it needs", async () => {
        const flow = mount(flowOf({ a: [0, 0], b: [10, 10] }), {
            sizes: { a: [10, 10] },
            engine: { fitView: true },
        });
        await Promise.resolve();
        expect(flow.engine.is("ready")).toBe(false);
        flow.sizes.set("b", [10, 10]);
        flow.observer()?.trigger([flow.node("b")]);
        await Promise.resolve();
        expect(flow.engine.is("ready")).toBe(true);
    });
});
