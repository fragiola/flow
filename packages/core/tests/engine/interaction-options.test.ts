// @vitest-environment jsdom
// The interaction options (#32): the tap distances on the pane and on nodes, `preventScrolling`,
// auto-pan per gesture, the per-kind switches of `set-interactive` (read through the host by every
// feature, and by `interactive-by`), and focusability.
import { afterEach, describe, expect, it } from "vitest";
import { connection } from "../../src/connection/connection";
import { drag } from "../../src/drag/drag";
import { autoPans } from "../../src/engine/auto-pan";
import { keyboard } from "../../src/keyboard/keyboard";
import { reconnection } from "../../src/reconnection/reconnection";
import { selection } from "../../src/selection/selection";
import {
    flowOf,
    type HandleSpec,
    installFrames,
    key,
    mount,
    pointer,
    unmountAll,
    wheel,
} from "./harness";

afterEach(unmountAll);

const at = (clientX: number, clientY: number) => ({ clientX, clientY });

const handles: HandleSpec[] = [
    {
        nodeId: "a",
        handleId: "out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    { nodeId: "b", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
];

const twoNodes = () => ({
    ...flowOf({ a: [0, 0], b: [300, 0] }),
    edges: [
        {
            id: "e",
            source: "a",
            target: "b",
            sourceHandle: "out",
            targetHandle: "in",
        },
    ],
});

describe("the tap distances", () => {
    it("keep 3 px on the pane and on nodes by default", () => {
        const { root, node, events } = mount(flowOf({ a: [0, 0] }), {
            sizes: { a: [100, 50] },
        });
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(503, 400));
        pointer(root, "pointerup", at(503, 400));
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(504, 400));
        pointer(root, "pointerup", at(504, 400));
        expect(events.filter((e) => e.type === "pane-click")).toHaveLength(1);
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointermove", at(13, 10));
        pointer(root, "pointerup", at(13, 10));
        expect(events.filter((e) => e.type === "node-click")).toHaveLength(1);
    });

    it("take paneClickDistance and nodeClickDistance", () => {
        const { root, node, events, model } = mount(flowOf({ a: [0, 0] }), {
            features: [selection()],
            sizes: { a: [100, 50] },
            engine: { paneClickDistance: 0, nodeClickDistance: 10 },
        });
        model.run("selection.set", { nodeIds: ["a"] });
        // a pane press that moved 1 px is no tap: the selection stays
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(501, 400));
        pointer(root, "pointerup", at(501, 400));
        expect(model.get("selected-nodes")).toHaveLength(1);
        expect(events.some((e) => e.type === "pane-click")).toBe(false);
        model.run("selection.clear");
        // a node press that moved 8 px still selects (no drag installed)
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointermove", at(18, 10));
        pointer(root, "pointerup", at(18, 10));
        expect(model.is("node-selected", { nodeId: "a" })).toBe(true);
    });

    it("follow setOptions", () => {
        const { root, engine, events } = mount(flowOf({}));
        engine.adapter.setOptions({ paneClickDistance: 20 });
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(515, 400));
        pointer(root, "pointerup", at(515, 400));
        expect(events.some((e) => e.type === "pane-click")).toBe(true);
    });
});

describe("preventScrolling", () => {
    it("keeps the wheel from the page even when no wheel gesture uses it", () => {
        const on = mount(flowOf({}), {
            engine: { zoomOnScroll: false, panOnScroll: false },
        });
        expect(wheel(on.root, { deltaY: 100 }).defaultPrevented).toBe(true);
        expect(on.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        unmountAll();
        const off = mount(flowOf({}), {
            engine: { zoomOnScroll: false, preventScrolling: false },
        });
        expect(wheel(off.root, { deltaY: 100 }).defaultPrevented).toBe(false);
    });

    it("leaves a no-wheel element and the controls their wheel", () => {
        const { root } = mount(flowOf({}));
        const field = document.createElement("div");
        field.setAttribute("data-flow-no-wheel", "");
        root.append(field);
        const controls = document.createElement("div");
        controls.setAttribute("data-flow-part", "controls");
        root.append(controls);
        expect(wheel(field, { deltaY: 100 }).defaultPrevented).toBe(false);
        expect(wheel(controls, { deltaY: 100 }).defaultPrevented).toBe(false);
    });
});

describe("auto-pan per gesture", () => {
    it("answers whether a gesture's kind is followed", () => {
        expect(autoPans(undefined, "node")).toBe(true);
        expect(autoPans(true, "connect")).toBe(true);
        expect(autoPans(false, "node")).toBe(false);
        expect(autoPans({ connect: false }, "connect")).toBe(false);
        expect(autoPans({ connect: false }, "node")).toBe(true);
        expect(autoPans({ speed: 5 }, "resize")).toBe(true);
        expect(autoPans({ node: false }, true)).toBe(true);
        expect(autoPans(true, undefined)).toBe(false);
    });

    it("pans for a drag but not for a connection with { connect: false }", () => {
        const frames = installFrames();
        const flow = mount(flowOf({ a: [300, 250], b: [600, 250] }), {
            features: [drag(), connection()],
            sizes: { a: [100, 50], b: [100, 50] },
            handles: [
                {
                    nodeId: "b",
                    handleId: "out",
                    type: "source",
                    side: "right",
                    x: 95,
                    y: 20,
                },
            ],
            engine: { autoPan: { connect: false } },
        });
        pointer(flow.handle("b", "source", "out"), "pointerdown", at(700, 275));
        pointer(flow.root, "pointermove", at(5, 275));
        frames.frame();
        expect(flow.engine.get("viewport").x).toBe(0);
        pointer(flow.root, "pointerup", at(5, 275));
        pointer(flow.node("a"), "pointerdown", at(320, 260));
        pointer(flow.root, "pointermove", at(5, 260));
        frames.frame();
        expect(flow.engine.get("viewport").x).toBeGreaterThan(0);
        pointer(flow.root, "pointerup", at(5, 260));
    });
});

describe("set-interactive per kind", () => {
    const full = () =>
        mount(twoNodes(), {
            features: [
                selection(),
                drag(),
                connection(),
                reconnection(),
                keyboard(),
            ],
            sizes: { a: [100, 50], b: [100, 50] },
            handles,
        });

    it("keeps the switches it is not given, and validates them", () => {
        const { engine } = full();
        expect(engine.run("set-interactive", { drag: false })).toEqual({
            ok: true,
            value: {
                interactive: true,
                drag: false,
                connect: true,
                select: true,
                reconnect: true,
            },
        });
        expect(engine.is("interactive")).toBe(true);
        expect(engine.is("interactive-by", { kind: "drag" })).toBe(false);
        expect(engine.is("interactive-by", { kind: "select" })).toBe(true);
        expect(
            engine.check("set-interactive", { select: "no" as never }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/select" },
        });
        expect(engine.check("set-interactive", {})).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        // a dry run changes nothing
        engine.check("set-interactive", { connect: false });
        expect(engine.is("interactive-by", { kind: "connect" })).toBe(true);
        // `interactive: false` turns every kind off, its own switches kept
        engine.run("set-interactive", { interactive: false });
        expect(engine.is("interactive-by", { kind: "select" })).toBe(false);
        engine.run("set-interactive", { interactive: true });
        expect(engine.is("interactive-by", { kind: "select" })).toBe(true);
        expect(engine.is("interactive-by", { kind: "drag" })).toBe(false);
    });

    it("drag: false stops node drags and the arrows, and nothing else", () => {
        const { engine, root, node, model } = full();
        engine.run("set-interactive", { drag: false });
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointermove", at(40, 10));
        pointer(root, "pointerup", at(40, 10));
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
        key(node("a"), "ArrowRight");
        expect(model.get("node-by", { id: "a" })?.position.x).toBe(0);
        // a tap still selects
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointerup", at(10, 10));
        expect(model.is("node-selected", { nodeId: "a" })).toBe(true);
    });

    it("select: false stops taps, the box and Enter, and a drag selects nothing", () => {
        const { engine, root, node, model } = full();
        engine.run("set-interactive", { select: false });
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointerup", at(10, 10));
        expect(model.get("selected-nodes")).toEqual([]);
        key(node("a"), "Enter");
        expect(model.get("selected-nodes")).toEqual([]);
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointermove", at(30, 10));
        pointer(root, "pointerup", at(30, 10));
        expect(model.get("node-by", { id: "a" })?.position.x).toBe(20);
        expect(model.get("selected-nodes")).toEqual([]);
        pointer(root, "pointerdown", { ...at(500, 400), shiftKey: true });
        pointer(root, "pointermove", { ...at(10, 10), shiftKey: true });
        expect(engine.is("box-selecting")).toBe(false);
    });

    it("connect: false and reconnect: false stop their gestures", () => {
        const { engine, root, handle, model } = full();
        engine.run("set-interactive", { connect: false, reconnect: false });
        model.run("edge.remove", { edgeId: "e" });
        pointer(handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(root, "pointermove", at(200, 25));
        expect(engine.is("connecting")).toBe(false);
        pointer(root, "pointerup", at(200, 25));
        // a focused handle takes no focus while connecting is off
        expect(
            engine.adapter.attributes("handle", {
                nodeId: "a",
                handleId: "out",
                type: "source",
                side: "right",
            }).tabindex,
        ).toBeUndefined();
        engine.run("set-interactive", { connect: true });
        pointer(handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(root, "pointermove", at(295, 25));
        pointer(root, "pointerup", at(295, 25));
        expect(model.get("all-edges")).toHaveLength(1);
        expect(engine.is("interactive-by", { kind: "reconnect" })).toBe(false);
    });

    it("cancels the gesture under way when its switch turns off", () => {
        const { engine, root, node, model } = full();
        pointer(node("a"), "pointerdown", at(10, 10));
        pointer(root, "pointermove", at(50, 10));
        expect(engine.is("dragging")).toBe(true);
        engine.run("set-interactive", { drag: false });
        expect(engine.is("dragging")).toBe(false);
        expect(model.get("node-by", { id: "a" })?.position.x).toBe(0);
    });

    it("keeps a gesture of another kind, and a pan, going", () => {
        const { engine, root, node } = full();
        pointer(root, "pointerdown", at(500, 400));
        pointer(root, "pointermove", at(540, 400));
        engine.run("set-interactive", { reconnect: false, drag: false });
        expect(engine.get("viewport").x).toBe(40);
        pointer(root, "pointermove", at(560, 400));
        pointer(root, "pointerup", at(560, 400));
        expect(engine.get("viewport").x).toBe(60);
        engine.run("set-interactive", { drag: true });
        pointer(node("a"), "pointerdown", at(70, 10));
        pointer(root, "pointermove", at(100, 10));
        engine.run("set-interactive", { select: false });
        expect(engine.is("dragging")).toBe(true);
        // interactive: false stops everything
        engine.run("set-interactive", { interactive: false });
        expect(engine.is("dragging")).toBe(false);
    });
});

describe("focusability", () => {
    it("a node's or edge's focusable: false, and the global options, take no focus", () => {
        const json = twoNodes();
        const flow = mount(
            {
                ...json,
                nodes: json.nodes.map((node) =>
                    node.id === "b" ? { ...node, focusable: false } : node,
                ),
                edges: [{ ...json.edges[0], focusable: false }] as never,
            },
            { features: [keyboard()], sizes: { a: [100, 50], b: [100, 50] } },
        );
        expect(flow.engine.is("node-focusable", { nodeId: "a" })).toBe(true);
        expect(flow.engine.is("node-focusable", { nodeId: "b" })).toBe(false);
        expect(flow.engine.is("edge-focusable", { edgeId: "e" })).toBe(false);
        flow.model.run("edge.set-flags", { edgeId: "e", focusable: true });
        expect(flow.engine.is("edge-focusable", { edgeId: "e" })).toBe(true);
        flow.engine.adapter.setOptions({
            nodesFocusable: false,
            edgesFocusable: false,
        });
        expect(flow.engine.is("node-focusable", { nodeId: "a" })).toBe(false);
        expect(flow.engine.is("edge-focusable", { edgeId: "e" })).toBe(false);
    });
});
