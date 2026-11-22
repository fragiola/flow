// @vitest-environment jsdom
// The toolbar reads on an engine: `edge-toolbar-by` (an edge's label point or one of its ends on
// the screen, outside the zoom, undefined until the edge is drawn) and `node-toolbar-by` with
// `nodeIds` (beside the nodes' bounds), the one-node payload unchanged.
import { afterEach, describe, expect, it } from "vitest";
import { edgeToolbarPosition } from "../../src/engine/edge-toolbar";
import { nodeToolbarPosition } from "../../src/engine/node-toolbar";
import type { HandleSpec } from "./harness";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

// a's source on its right at (100, 25); b's target on its left at (300, 125)
const handles: HandleSpec[] = [
    { nodeId: "a", type: "source", side: "right", x: 95, y: 20 },
    { nodeId: "b", type: "target", side: "left", x: -5, y: 20 },
];

function flow(extra: { sized?: boolean } = {}) {
    const json = flowOf(
        { a: [0, 0], b: [300, 100], c: [100, 300] },
        {
            edges: [
                { id: "ab", source: "a", target: "b", type: "straight" },
                { id: "ac", source: "a", target: "c" },
            ],
        },
    );
    return mount(json, {
        sizes: {
            a: [100, 50],
            b: [100, 50],
            ...(extra.sized === false ? {} : { c: [50, 50] }),
        },
        handles,
        engine: { defaultViewport: { x: 10, y: 20, zoom: 2 } },
    });
}

describe("edge-toolbar-by", () => {
    it("stands at the edge's label point on the screen, its centre there", () => {
        const { engine } = flow();
        // the straight edge's label: (200, 75) → 200 * 2 + 10, 75 * 2 + 20
        expect(engine.get("edge-toolbar-by", { edgeId: "ab" })).toEqual({
            x: 410,
            y: 170,
            anchorX: 0.5,
            anchorY: 0.5,
        });
        expect(
            engine.get("edge-toolbar-by", { edgeId: "ab", position: "label" }),
        ).toEqual(engine.get("edge-toolbar-by", { edgeId: "ab" }));
    });

    it("or at either end, moved by a screen offset", () => {
        const { engine } = flow();
        expect(
            engine.get("edge-toolbar-by", { edgeId: "ab", position: "source" }),
        ).toMatchObject({ x: 210, y: 70 });
        expect(
            engine.get("edge-toolbar-by", {
                edgeId: "ab",
                position: "target",
                offset: { x: 0, y: -12 },
            }),
        ).toMatchObject({ x: 610, y: 258 });
    });

    it("follows the viewport, its offset outside the zoom", () => {
        const { engine } = flow();
        engine.run("set-viewport", { x: 0, y: 0, zoom: 1 });
        expect(
            engine.get("edge-toolbar-by", {
                edgeId: "ab",
                offset: { x: 5, y: 5 },
            }),
        ).toMatchObject({ x: 205, y: 80 });
    });

    it("is undefined until the edge has a path, and for a missing edge", () => {
        const { engine } = flow({ sized: false });
        expect(engine.get("edge-toolbar-by", { edgeId: "ac" })).toBeUndefined();
        expect(engine.get("edge-toolbar-by", { edgeId: "zz" })).toBeUndefined();
        const get = engine.get as (key: string, payload?: unknown) => unknown;
        expect(get("edge-toolbar-by")).toBeUndefined();
    });

    it("its toolbar part stands for the edge", () => {
        const { engine } = flow();
        expect(engine.adapter.attributes("toolbar", { edgeId: "ab" })).toEqual({
            "data-flow-part": "toolbar",
            "data-flow-id": "ab",
        });
        expect(engine.adapter.attributes("toolbar", { nodeId: "a" })).toEqual({
            "data-flow-part": "toolbar",
            "data-flow-id": "a",
        });
        expect(engine.adapter.attributes("toolbar", {})).toEqual({
            "data-flow-part": "toolbar",
        });
    });

    it("the pure placement: a path's points on the screen", () => {
        const path = {
            path: "M0,0 L10,10",
            label: { x: 5, y: 5 },
            source: { x: 0, y: 0 },
            sourceSide: "right" as const,
            target: { x: 10, y: 10 },
            targetSide: "left" as const,
        };
        expect(
            edgeToolbarPosition(path, { x: 1, y: 2, zoom: 3 }, { edgeId: "e" }),
        ).toEqual({ x: 16, y: 17, anchorX: 0.5, anchorY: 0.5 });
    });
});

describe("node-toolbar-by with nodeIds", () => {
    it("stands beside the bounds of the nodes", () => {
        const { engine } = flow();
        // a and b: (0, 0) to (400, 150) → on the screen (10, 20) to (810, 320)
        expect(engine.get("node-toolbar-by", { nodeIds: ["a", "b"] })).toEqual({
            x: 410,
            y: 10,
            anchorX: 0.5,
            anchorY: 1,
        });
        expect(
            engine.get("node-toolbar-by", {
                nodeIds: ["a", "b"],
                side: "bottom",
                align: "end",
                offset: 4,
            }),
        ).toEqual({ x: 810, y: 324, anchorX: 1, anchorY: 0 });
    });

    it("leaves out the nodes of unknown size, and is undefined with none", () => {
        const sized = flow({ sized: false });
        expect(
            sized.engine.get("node-toolbar-by", { nodeIds: ["a", "c"] }),
        ).toEqual(sized.engine.get("node-toolbar-by", { nodeId: "a" }));
        expect(
            sized.engine.get("node-toolbar-by", { nodeIds: ["c", "zz"] }),
        ).toBeUndefined();
    });

    it("keeps the one-node payload, and nodeIds wins over it when not empty", () => {
        const { engine } = flow();
        const one = engine.get("node-toolbar-by", { nodeId: "b" });
        expect(one).toEqual(
            nodeToolbarPosition(
                { x: 300, y: 100, width: 100, height: 50 },
                engine.get("viewport"),
                { nodeId: "b" },
            ),
        );
        expect(engine.get("node-toolbar-by", { nodeIds: ["b"] })).toEqual(one);
        expect(
            engine.get("node-toolbar-by", { nodeId: "b", nodeIds: [] }),
        ).toEqual(one);
        expect(
            engine.get("node-toolbar-by", { nodeId: "b", nodeIds: ["a"] }),
        ).toEqual(engine.get("node-toolbar-by", { nodeId: "a" }));
        expect(engine.get("node-toolbar-by", {})).toBeUndefined();
    });
});

describe("edge-toolbar-by at a point, aligned", () => {
    it("stands at a flow point instead of the label point, with alignX and alignY", () => {
        const { engine } = flow();
        // (50, 40) → 50 * 2 + 10, 40 * 2 + 20
        expect(
            engine.get("edge-toolbar-by", {
                edgeId: "ab",
                point: { x: 50, y: 40 },
                position: "source",
                offset: { x: 1, y: -1 },
            }),
        ).toEqual({ x: 111, y: 99, anchorX: 0.5, anchorY: 0.5 });
        expect(
            engine.get("edge-toolbar-by", {
                edgeId: "ab",
                alignX: "start",
                alignY: "end",
            }),
        ).toEqual({ x: 410, y: 170, anchorX: 0, anchorY: 1 });
        expect(
            engine.get("edge-toolbar-by", {
                edgeId: "ab",
                alignX: "end",
                alignY: "start",
            }),
        ).toMatchObject({ anchorX: 1, anchorY: 0 });
        // a point that is no point is the label point's
        const get = engine.get as (key: string, payload: unknown) => unknown;
        expect(
            get("edge-toolbar-by", { edgeId: "ab", point: { x: "1" } }),
        ).toEqual(engine.get("edge-toolbar-by", { edgeId: "ab" }));
    });
});
