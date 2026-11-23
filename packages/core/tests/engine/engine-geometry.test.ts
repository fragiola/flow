// @vitest-environment jsdom
// The engine's cached geometry (Issue #59): each cache follows what it depends on (a move, a
// resize, a reparent, a measurement, a removal, the path options, the node origin), the lists keep
// their array while their content is unchanged, and with `onlyRenderVisible` nothing is visible
// before the root has a size. The random equivalence with a fresh engine is
// geometry-equivalence.test.ts.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { EngineGeometry } from "../../src/engine/engine-geometry";
import { subflows } from "../../src/subflows/subflows";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const sizes = {
    a: [100, 40],
    b: [100, 40],
    c: [100, 40],
} as Record<string, [number, number]>;

const json = (): FlowJson =>
    flowOf(
        { a: [0, 0], b: [300, 0], c: [2000, 2000] },
        {
            edges: [
                { id: "ab", source: "a", target: "b" },
                { id: "bc", source: "b", target: "c" },
            ],
        },
    );

const ids = (list: readonly { id: string }[]) => list.map((item) => item.id);

describe("the cached geometry follows", () => {
    it("a move: the node's box, its edges' paths and the visible lists", () => {
        const { engine, model } = mount(json(), {
            sizes,
            engine: { onlyRenderVisible: true },
        });
        const path = engine.get("edge-path-by", { edgeId: "ab" });
        expect(path?.target).toEqual({ x: 350, y: 0 });
        expect(ids(engine.get("visible-nodes"))).toEqual(["a", "b"]);
        model.run("node.move", { nodeId: "b", position: { x: 300, y: 100 } });
        expect(engine.get("node-rect-by", { nodeId: "b" })).toEqual({
            x: 300,
            y: 100,
            width: 100,
            height: 40,
        });
        expect(engine.get("edge-path-by", { edgeId: "ab" })?.target).toEqual({
            x: 350,
            y: 100,
        });
        // moved into the view, c and its edge come in
        model.run("node.move", { nodeId: "c", position: { x: 500, y: 300 } });
        expect(ids(engine.get("visible-nodes"))).toEqual(["a", "b", "c"]);
        expect(ids(engine.get("visible-edges"))).toEqual(["ab", "bc"]);
        model.run("node.move", { nodeId: "a", position: { x: -900, y: 0 } });
        expect(ids(engine.get("visible-nodes"))).toEqual(["b", "c"]);
        expect(ids(engine.get("visible-edges"))).toEqual(["ab", "bc"]);
    });

    it("a resize: the box and the edge ends", () => {
        const flow = mount(json(), {
            sizes: { a: [100, 40] },
        });
        flow.model.run("node.resize", { nodeId: "b", width: 200, height: 80 });
        expect(flow.engine.get("node-rect-by", { nodeId: "b" })).toEqual({
            x: 300,
            y: 0,
            width: 200,
            height: 80,
        });
        expect(
            flow.engine.get("edge-path-by", { edgeId: "ab" })?.target,
        ).toEqual({ x: 400, y: 0 });
    });

    it("a reparent and a parent's move: a child's box follows its parent", () => {
        const { engine, model } = mount(json(), {
            sizes,
            features: [subflows()],
        });
        model.run("node.set-parent", { nodeId: "b", parentId: "a" });
        // its place on screen kept
        expect(engine.get("node-rect-by", { nodeId: "b" })).toMatchObject({
            x: 300,
            y: 0,
        });
        model.run("node.move", { nodeId: "a", position: { x: 50, y: 50 } });
        expect(engine.get("node-rect-by", { nodeId: "b" })).toMatchObject({
            x: 350,
            y: 50,
        });
        expect(engine.get("edge-path-by", { edgeId: "bc" })?.source).toEqual({
            x: 400,
            y: 90,
        });
        model.run("node.set-parent", { nodeId: "b", parentId: null });
        model.run("node.move", { nodeId: "a", position: { x: 0, y: 0 } });
        expect(engine.get("node-rect-by", { nodeId: "b" })).toMatchObject({
            x: 350,
            y: 50,
        });
    });

    it("a measurement: a new size, and a handle registered", async () => {
        const flow = mount(json(), { sizes });
        flow.sizes.set("a", [60, 20]);
        flow.observer()?.trigger([flow.node("a")]);
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toMatchObject({
            width: 60,
            height: 20,
        });
        expect(
            flow.engine.get("edge-path-by", { edgeId: "ab" })?.source,
        ).toEqual({ x: 30, y: 20 });
        const handle = document.createElement("div");
        handle.getBoundingClientRect = () =>
            ({
                left: 50,
                top: 5,
                width: 10,
                height: 10,
                right: 60,
                bottom: 15,
                x: 50,
                y: 5,
                toJSON: () => ({}),
            }) as DOMRect;
        flow.node("a").append(handle);
        flow.engine.adapter.registerHandle(
            { nodeId: "a", type: "source", side: "right" },
            handle,
        );
        expect(
            flow.engine.get("edge-path-by", { edgeId: "ab" })?.source,
        ).toEqual({ x: 55, y: 10 });
        // the handle goes: the default end again
        flow.engine.adapter.registerHandle(
            { nodeId: "a", type: "source", side: "right" },
            null,
        );
        await Promise.resolve();
        expect(
            flow.engine.get("edge-path-by", { edgeId: "ab" })?.source,
        ).toEqual({ x: 30, y: 20 });
    });

    it("a removal: the node, its edges and the lists", () => {
        const { engine, model } = mount(json(), { sizes });
        model.run("node.remove", { nodeId: "b" });
        expect(engine.get("node-rect-by", { nodeId: "b" })).toBeUndefined();
        expect(engine.get("edge-path-by", { edgeId: "ab" })).toBeUndefined();
        expect(ids(engine.get("visible-nodes"))).toEqual(["a"]);
        expect(engine.get("drawn-edges")).toEqual([]);
        expect(engine.get("intersecting-nodes", { nodeId: "a" })).toEqual([]);
    });

    it("the path options and the node origin", () => {
        const { engine } = mount(json(), { sizes });
        const before = engine.get("edge-path-by", { edgeId: "ab" })?.path;
        engine.adapter.setOptions({ pathOptions: { curvature: 1 } });
        const after = engine.get("edge-path-by", { edgeId: "ab" })?.path;
        expect(after).not.toBe(before);
        engine.adapter.setOptions({ pathOptions: { curvature: 0.5 } });
        expect(engine.get("edge-path-by", { edgeId: "ab" })?.path).toBe(before);
        engine.adapter.setOptions({ nodeOrigin: { x: 0.5, y: 0.5 } });
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: -50,
            y: -20,
            width: 100,
            height: 40,
        });
        expect(engine.get("edge-path-by", { edgeId: "ab" })?.source).toEqual({
            x: 0,
            y: 20,
        });
    });
});

describe("the cached lists", () => {
    it("keep their array while their content is unchanged", () => {
        const { engine, model } = mount(json(), {
            sizes,
            engine: { onlyRenderVisible: true },
        });
        const nodes = engine.get("visible-nodes");
        const edges = engine.get("visible-edges");
        const drawn = engine.get("drawn-edges");
        const layers = engine.get("render-layers");
        expect(engine.get("visible-nodes")).toBe(nodes);
        expect(engine.get("drawn-edges")).toBe(drawn);
        // a pan that keeps the same nodes and edges in view
        engine.run("pan-by", { x: 10, y: 10 });
        expect(engine.get("visible-nodes")).toBe(nodes);
        expect(engine.get("visible-edges")).toBe(edges);
        expect(engine.get("drawn-edges")).toBe(drawn);
        expect(engine.get("render-layers")).toBe(layers);
        expect(Object.isFrozen(nodes)).toBe(true);
        // a change of content is a new array
        model.run("node.move", { nodeId: "a", position: { x: 5, y: 5 } });
        const moved = engine.get("visible-nodes");
        expect(moved).not.toBe(nodes);
        expect(moved[0]).toBe(model.get("node-by", { id: "a" }));
        engine.run("pan-by", { x: 0, y: -600 });
        expect(ids(engine.get("visible-nodes"))).toEqual([]);
    });

    it("are empty with onlyRenderVisible until the root has a size; without it, every shown node", () => {
        const culled = mount(json(), {
            sizes,
            engine: { onlyRenderVisible: true },
            root: { left: 0, top: 0, width: 0, height: 0 },
        });
        expect(culled.engine.get("visible-nodes")).toEqual([]);
        expect(culled.engine.get("visible-edges")).toEqual([]);
        expect(culled.engine.get("drawn-edges")).toEqual([]);
        culled.root.getBoundingClientRect = () =>
            ({
                left: 0,
                top: 0,
                width: 800,
                height: 600,
                right: 800,
                bottom: 600,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            }) as DOMRect;
        expect(ids(culled.engine.get("visible-nodes"))).toEqual(["a", "b"]);
        // bc's ends' box (b to c) meets the view
        expect(ids(culled.engine.get("drawn-edges"))).toEqual(["ab", "bc"]);
        const shown = mount(json(), {
            sizes,
            root: { left: 0, top: 0, width: 0, height: 0 },
        });
        expect(ids(shown.engine.get("visible-nodes"))).toEqual(["a", "b", "c"]);
        expect(ids(shown.engine.get("drawn-edges"))).toEqual(["ab", "bc"]);
    });
});

describe("the cached geometry is released", () => {
    it("by the engine's destroy: its maps and grids are emptied", () => {
        type Caches = {
            nodeEntries: Map<string, unknown>;
            edgeEntries: Map<string, unknown>;
            nodeGrid: { size: number };
            edgeGrid: { size: number };
        };
        const sizesOf = (caches: Caches) => [
            caches.nodeEntries.size,
            caches.edgeEntries.size,
            caches.nodeGrid.size,
            caches.edgeGrid.size,
        ];
        const release = EngineGeometry.prototype.release;
        let before: number[] = [];
        let released: Caches | undefined;
        const spy = vi
            .spyOn(EngineGeometry.prototype, "release")
            .mockImplementation(function (this: EngineGeometry) {
                released = this as unknown as Caches;
                before = sizesOf(released);
                release.call(this);
            });
        try {
            const { engine } = mount(json(), {
                sizes,
                engine: { onlyRenderVisible: true },
            });
            expect(ids(engine.get("visible-edges"))).toEqual(["ab", "bc"]);
            engine.destroy();
            expect(before).toEqual([3, 2, 3, 2]);
            expect(released && sizesOf(released)).toEqual([0, 0, 0, 0]);
        } finally {
            spy.mockRestore();
        }
    });
});
