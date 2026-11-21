// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { connection } from "../../src/connection/connection";
import { createFlowEngine } from "../../src/engine/create-flow-engine";
import { createFlowModel } from "../../src/model/create-flow-model";
import { flowOf, mount, pointer, unmountAll } from "./harness";

afterEach(unmountAll);

describe("createFlowEngine", () => {
    it("exposes exactly the verbs, subscribe, destroy and adapter, bound", () => {
        const engine = createFlowEngine(createFlowModel());
        expect(Object.keys(engine).sort()).toEqual([
            "adapter",
            "can",
            "check",
            "destroy",
            "get",
            "is",
            "run",
            "subscribe",
        ]);
        expect(Object.isFrozen(engine)).toBe(true);
        expect(Object.keys(engine.adapter).sort()).toEqual([
            "attachRoot",
            "attachViewport",
            "attributes",
            "detachRoot",
            "getSnapshot",
            "model",
            "registerEdge",
            "registerHandle",
            "registerNode",
            "setPartOptions",
            "settings",
            "subscribe",
        ]);
        const { run, get, is, can, check } = engine;
        expect(run("pan-by", { x: 5, y: 0 }).ok).toBe(true);
        expect(get("viewport")).toEqual({ x: 5, y: 0, zoom: 1 });
        expect(is("interactive")).toBe(true);
        expect(can("cancel-gesture")).toBe(false);
        expect(check("cancel-gesture")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("runs in plain node, with no root, and never throws on bad input", () => {
        const engine = createFlowEngine(createFlowModel(flowOf({ a: [0, 0] })));
        expect(engine.get("root-size")).toEqual({ width: 0, height: 0 });
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        });
        expect(engine.is("node-measured", { nodeId: "a" })).toBe(false);
        expect(engine.run("fit-view", {})).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        // @ts-expect-error an unknown action
        expect(engine.run("explode", {})).toMatchObject({
            ok: false,
            error: { code: "unknown_command" },
        });
        expect(engine.run("pan-by", { x: Number.NaN, y: 0 })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        expect(engine.run("zoom-to", { zoom: -1 })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        // a key of a feature that is not installed: nothing
        // @ts-expect-error `connection` is the connection feature's
        expect(engine.get("connection")).toBeUndefined();
        // @ts-expect-error `dragging` is the drag feature's
        expect(engine.is("dragging")).toBe(false);
    });

    it("types the features' keys by the installed features", () => {
        const model = createFlowModel(flowOf({}), { features: [connection()] });
        const engine = createFlowEngine(model);
        expect(engine.get("connection")).toBeNull();
        expect(engine.is("connecting")).toBe(false);
    });

    it("sets the viewport, kept to the zoom limits, and tells the app", () => {
        const { engine, events } = mount(flowOf({}));
        expect(engine.run("set-viewport", { x: 10, zoom: 5 })).toEqual({
            ok: true,
            value: { x: 10, y: 0, zoom: 2 },
        });
        expect(engine.check("set-viewport", { zoom: 0.1 })).toEqual({
            ok: true,
            value: { x: 10, y: 0, zoom: 0.5 },
        });
        expect(engine.get("viewport").zoom).toBe(2);
        expect(events).toEqual([
            {
                type: "viewport-change",
                viewport: { x: 10, y: 0, zoom: 2 },
                gesture: false,
            },
        ]);
        // the same viewport again changes nothing
        engine.run("set-viewport", { x: 10 });
        expect(events).toHaveLength(1);
    });

    it("writes the transform to the viewport element directly", () => {
        const { engine, viewport } = mount(flowOf({}));
        expect(viewport.style.transform).toBe("translate(0px, 0px) scale(1)");
        expect(viewport.style.transformOrigin).toBe("0 0");
        engine.run("set-viewport", { x: 12, y: -4, zoom: 1.5 });
        expect(viewport.style.transform).toBe(
            "translate(12px, -4px) scale(1.5)",
        );
        engine.adapter.attachViewport(null);
        expect(viewport.style.transform).toBe("");
    });

    it("zooms in and out by a step around the root's centre, refused at the limits", () => {
        const { engine } = mount(flowOf({}));
        expect(engine.run("zoom-in", {})).toEqual({
            ok: true,
            value: { x: -80, y: -60, zoom: 1.2 },
        });
        engine.run("zoom-to", { zoom: 2 });
        expect(engine.can("zoom-in", {})).toBe(false);
        expect(engine.run("zoom-in", {})).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        engine.run("zoom-to", { zoom: 0.5, around: { x: 0, y: 0 } });
        expect(engine.can("zoom-out", {})).toBe(false);
        expect(
            engine.run("zoom-in", { step: 2, around: { x: 0, y: 0 } }),
        ).toMatchObject({
            ok: true,
            value: { zoom: 1 },
        });
        expect(engine.run("zoom-in", { step: 0.5 })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
    });

    it("fits the nodes with padding, or some of them, once measured", () => {
        const { engine } = mount(
            flowOf({ a: [0, 0], b: [300, 100], c: [1000, 1000] }),
            {
                sizes: { a: [100, 100], b: [100, 50], c: [10, 10] },
                engine: { maxZoom: 4 },
            },
        );
        // a and b: (0, 0) to (400, 150); 80% of 800 × 600 → zoom min(1.6, 3.2)
        expect(engine.run("fit-view", { nodeIds: ["a", "b"] })).toEqual({
            ok: true,
            value: { x: 80, y: 180, zoom: 1.6 },
        });
        expect(
            engine.run("fit-view", { nodeIds: ["a", "b"], padding: 0 }).ok,
        ).toBe(true);
        expect(engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
        // every node: 480 / 1010 is under the least zoom
        expect(engine.run("fit-view", {})).toMatchObject({
            ok: true,
            value: { zoom: 0.5 },
        });
        // its own limits narrow the engine's
        expect(engine.run("fit-view", { nodeIds: ["a"], maxZoom: 1 })).toEqual({
            ok: true,
            value: { x: 350, y: 250, zoom: 1 },
        });
        expect(engine.get("nodes-bounds")).toEqual({
            x: 0,
            y: 0,
            width: 1010,
            height: 1010,
        });
    });

    it("fits the view once every node is measured (the fitView option)", () => {
        const { engine } = mount(flowOf({ a: [0, 0], b: [300, 100] }), {
            sizes: { a: [100, 100], b: [100, 50] },
            engine: { fitView: { padding: 0 }, maxZoom: 4 },
        });
        expect(engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
    });

    it("centres on a flow point and converts client points", () => {
        const { engine } = mount(flowOf({}), {
            root: { left: 10, top: 20, width: 800, height: 600 },
        });
        engine.run("center-on", { x: 100, y: 100, zoom: 2 });
        expect(engine.get("viewport")).toEqual({ x: 200, y: 100, zoom: 2 });
        expect(engine.get("screen-to-flow", { x: 410, y: 320 })).toEqual({
            x: 100,
            y: 100,
        });
        expect(engine.get("flow-to-screen", { x: 100, y: 100 })).toEqual({
            x: 410,
            y: 320,
        });
    });

    it("keeps the view inside a translate extent", () => {
        const { engine } = mount(flowOf({}), {
            engine: {
                translateExtent: { x: 0, y: 0, width: 1000, height: 1000 },
            },
        });
        engine.run("pan-by", { x: 100, y: 100 });
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        engine.run("pan-by", { x: -500, y: -500 });
        expect(engine.get("viewport")).toEqual({ x: -200, y: -400, zoom: 1 });
    });

    it("focuses a node, panning it into view", () => {
        const { engine, node } = mount(flowOf({ a: [2000, 2000] }), {
            sizes: { a: [100, 100] },
        });
        expect(engine.run("focus-node", { nodeId: "a" })).toEqual({
            ok: true,
            value: { nodeId: "a" },
        });
        expect(document.activeElement).toBe(node("a"));
        expect(engine.get("viewport")).toEqual({ x: -1650, y: -1750, zoom: 1 });
        expect(engine.run("focus-node", { nodeId: "zz" })).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
    });

    it("toggles interactivity (the Controls' toggle)", () => {
        const { engine, root } = mount(flowOf({}));
        expect(engine.adapter.attributes("root")["data-interactive"]).toBe("");
        expect(engine.run("set-interactive", { interactive: false })).toEqual({
            ok: true,
            value: { interactive: false },
        });
        expect(engine.is("interactive")).toBe(false);
        expect(
            engine.adapter.attributes("root")["data-interactive"],
        ).toBeUndefined();
        // pan and zoom stay
        pointer(root, "pointerdown", { clientX: 0, clientY: 0 });
        pointer(root, "pointermove", { clientX: 10, clientY: 0 });
        pointer(root, "pointerup", { clientX: 10, clientY: 0 });
        expect(engine.get("viewport").x).toBe(10);
    });

    it("tells the adapters what changed, with a revision", () => {
        const { engine } = mount(flowOf({}));
        const changes: unknown[] = [];
        const remove = engine.adapter.subscribe((change) =>
            changes.push(change),
        );
        const before = engine.adapter.getSnapshot();
        engine.run("pan-by", { x: 1, y: 1 });
        expect(changes).toEqual([
            { viewport: true, measured: false, gesture: false },
        ]);
        expect(engine.adapter.getSnapshot()).toBeGreaterThan(before);
        remove();
        engine.run("pan-by", { x: 1, y: 1 });
        expect(changes).toHaveLength(1);
    });

    it("is released by destroy", () => {
        const { engine, root, viewport } = mount(flowOf({}));
        engine.destroy();
        expect(viewport.style.transform).toBe("");
        expect(engine.run("pan-by", { x: 1, y: 0 })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        pointer(root, "pointerdown", { clientX: 0, clientY: 0 });
        pointer(root, "pointermove", { clientX: 50, clientY: 0 });
        expect(engine.get("viewport").x).toBe(0);
    });
});
