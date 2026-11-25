// @vitest-environment jsdom
// The root's size is observed (#67): the engine's `ResizeObserver` watches the root from
// `attachRoot` to `detachRoot`, and a root that gets a size late (a hidden tab, a closed dialog)
// makes the flow ready, fits it on init and culls it, with no node measured. Only a change of size
// is told, once.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import {
    createFlowEngine,
    type FlowEngineOptions,
} from "../../src/engine/create-flow-engine";
import type { FlowEngineEvent } from "../../src/engine/events";
import { minimap } from "../../src/minimap/minimap";
import { createFlowModel } from "../../src/model/create-flow-model";
import { FakeResizeObserver, unmountAll } from "./harness";

const stops: (() => void)[] = [];

afterEach(() => {
    for (const stop of stops.splice(0)) stop();
    unmountAll();
});

const json = (): FlowJson => ({
    version: 1,
    nodes: [
        {
            id: "a",
            type: "default",
            position: { x: 0, y: 0 },
            data: {},
            initialWidth: 100,
            initialHeight: 100,
        },
        {
            id: "b",
            type: "default",
            position: { x: 300, y: 100 },
            data: {},
            initialWidth: 100,
            initialHeight: 50,
        },
        {
            id: "far",
            type: "default",
            position: { x: 5000, y: 5000 },
            data: {},
            initialWidth: 10,
            initialHeight: 10,
            hidden: true,
        },
    ],
    edges: [],
});

/** An engine on a root of `size` with no node rendered: nothing is ever measured. */
function attach(flow: FlowJson, options: FlowEngineOptions = {}) {
    const view = window as Window & { ResizeObserver?: unknown };
    const original = view.ResizeObserver;
    view.ResizeObserver = FakeResizeObserver;
    const model = createFlowModel(flow, { features: [minimap()] });
    const engine = createFlowEngine(model, options);
    const size = { width: 0, height: 0 };
    const root = document.createElement("div");
    root.getBoundingClientRect = () =>
        ({
            x: 0,
            y: 0,
            left: 0,
            top: 0,
            width: size.width,
            height: size.height,
            right: size.width,
            bottom: size.height,
            toJSON: () => ({}),
        }) as DOMRect;
    document.body.append(root);
    const events: FlowEngineEvent[] = [];
    engine.subscribe((event) => events.push(event));
    const changes: { viewport: boolean; measured: boolean }[] = [];
    engine.adapter.subscribe((change) => changes.push(change));
    engine.adapter.attachRoot(root);
    stops.push(() => {
        engine.destroy();
        view.ResizeObserver = original;
    });
    const observer = () => {
        const instance = FakeResizeObserver.instances.at(-1);
        if (!instance) throw new Error("no observer");
        return instance;
    };
    /** the root gets a size, and its observer reports it */
    const resize = async (width: number, height: number) => {
        size.width = width;
        size.height = height;
        observer().trigger([root]);
        await Promise.resolve();
    };
    return { engine, root, events, changes, observer, resize };
}

describe("the root's size", () => {
    it("is observed from attachRoot to detachRoot", () => {
        const { engine, root, observer } = attach(json());
        expect(observer().observed.has(root)).toBe(true);
        engine.adapter.detachRoot();
        expect(observer().observed.has(root)).toBe(false);
    });

    it("makes a flow attached to a 0 × 0 root ready, fitted and culled once it has a size", async () => {
        const flow = attach(json(), {
            fitView: { padding: 0 },
            maxZoom: 4,
            onlyRenderVisible: true,
        });
        await Promise.resolve();
        expect(flow.engine.is("ready")).toBe(false);
        expect(flow.engine.get("visible-nodes")).toEqual([]);
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        await flow.resize(800, 600);
        expect(flow.engine.get("root-size")).toEqual({
            width: 800,
            height: 600,
        });
        // the framing of the declared sizes (400 × 150 in 800 × 600)
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
        expect(flow.engine.get("visible-nodes").map((n) => n.id)).toEqual([
            "a",
            "b",
        ]);
        expect(flow.engine.is("ready")).toBe(true);
        expect(flow.events.filter((e) => e.type === "ready")).toHaveLength(1);
    });

    it("makes an empty flow ready once its root has a size", async () => {
        const flow = attach({ version: 1, nodes: [], edges: [] });
        await Promise.resolve();
        expect(flow.engine.is("ready")).toBe(false);
        await flow.resize(400, 300);
        expect(flow.engine.is("ready")).toBe(true);
    });

    it("is told once per change, with the viewport, and not at all when it did not change", async () => {
        const flow = attach(json());
        await flow.resize(800, 600);
        flow.changes.length = 0;
        // the report `observe` makes, or a move: the same size
        flow.observer().trigger([flow.root]);
        await Promise.resolve();
        expect(flow.changes).toEqual([]);
        await flow.resize(600, 400);
        expect(flow.changes).toEqual([
            { viewport: true, measured: true, gesture: false },
        ]);
    });

    it("keeps the minimap's view in step", async () => {
        const flow = attach(json());
        await flow.resize(800, 600);
        const before = flow.engine.get("minimap-view", {
            width: 200,
            height: 150,
        });
        await flow.resize(1600, 600);
        const after = flow.engine.get("minimap-view", {
            width: 200,
            height: 150,
        });
        expect(after?.view.width).toBe(1600);
        expect(after?.view).not.toEqual(before?.view);
    });
});
