// @vitest-environment jsdom
// A node's own `origin`: it overrides the engine's `nodeOrigin` for that node in every box the
// engine derives (rects, handles, edge ends, bounds, `fit-view`, `visible-nodes`, the minimap, the
// node and edge toolbars, the selection box, drag, extent and resize). A child's position stays
// its box's top-left corner; a parent's origin moves its box and so its children.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { drag } from "../../src/drag/drag";
import type { FlowEngineOptions } from "../../src/engine/create-flow-engine";
import type { FlowFeatures } from "../../src/features/types";
import { minimap } from "../../src/minimap/minimap";
import { resize } from "../../src/resize/resize";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import {
    drag as dragOn,
    flowOf,
    type HandleSpec,
    mount,
    unmountAll,
} from "./harness";

afterEach(unmountAll);

const CENTRE = { x: 0.5, y: 0.5 };
const sizes = { a: [100, 50], b: [100, 50] } as Record<
    string,
    [number, number]
>;
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

/** `a` and `b` at these positions, each with `origin` when given, joined both ways. */
const json = (
    a: [number, number],
    b: [number, number],
    origin?: { x: number; y: number },
): FlowJson => {
    const flow = flowOf(
        { a, b },
        {
            edges: [
                {
                    id: "handles",
                    source: "a",
                    sourceHandle: "out",
                    target: "b",
                    targetHandle: "in",
                    type: "straight",
                },
                { id: "sides", source: "b", target: "a" },
            ],
        },
    );
    return origin
        ? {
              ...flow,
              nodes: flow.nodes.map((node) => ({ ...node, origin })),
          }
        : flow;
};

/** Each node centred on (100, 100) and (400, 100) by its own origin. */
const centred = <const F extends FlowFeatures = readonly []>(
    engine: FlowEngineOptions = {},
    features?: F,
) =>
    mount(json([100, 100], [400, 100], CENTRE), {
        features,
        sizes,
        handles,
        engine,
    });

/** The same boxes drawn from their top-left corners. */
const cornered = <const F extends FlowFeatures = readonly []>(
    engine: FlowEngineOptions = {},
    features?: F,
) => mount(json([50, 75], [350, 75]), { features, sizes, handles, engine });

describe("a node's own origin", () => {
    it("places its box, its handles and its edges' ends, over the engine's nodeOrigin", () => {
        // the engine's nodeOrigin (bottom-right) loses to each node's own
        const { engine } = centred({ nodeOrigin: { x: 1, y: 1 } });
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 50,
            y: 75,
            width: 100,
            height: 50,
        });
        expect(engine.get("internal-node-by", { nodeId: "a" })?.rect).toEqual(
            engine.get("node-rect-by", { nodeId: "a" }),
        );
        expect(engine.get("handles-by", { nodeId: "a" })).toMatchObject([
            { handleId: "out", center: { x: 150, y: 100 } },
        ]);
        expect(engine.get("edge-path-by", { edgeId: "handles" })).toEqual(
            cornered().engine.get("edge-path-by", { edgeId: "handles" }),
        );
        expect(engine.get("edge-path-by", { edgeId: "sides" })).toMatchObject({
            source: { x: 400, y: 125 },
            target: { x: 100, y: 75 },
        });
    });

    it("applies to that node only", () => {
        const flow = flowOf({ a: [100, 100], b: [400, 100] });
        const { engine } = mount(
            {
                ...flow,
                nodes: [{ ...flow.nodes[0], origin: CENTRE }, flow.nodes[1]],
            } as FlowJson,
            { sizes },
        );
        expect(engine.get("node-rect-by", { nodeId: "a" })).toMatchObject({
            x: 50,
            y: 75,
        });
        expect(engine.get("node-rect-by", { nodeId: "b" })).toMatchObject({
            x: 400,
            y: 100,
        });
    });

    it("gives the bounds, fit-view, visible nodes and the minimap of its box", () => {
        const flow = centred({}, [minimap()]);
        const same = cornered({}, [minimap()]);
        expect(flow.engine.get("nodes-bounds", {})).toEqual(
            same.engine.get("nodes-bounds", {}),
        );
        expect(flow.engine.run("fit-view", {})).toEqual(
            same.engine.run("fit-view", {}),
        );
        expect(
            flow.engine.get("minimap-view", { width: 200, height: 150 }).nodes,
        ).toEqual([
            { nodeId: "a", x: 50, y: 75, width: 100, height: 50 },
            { nodeId: "b", x: 350, y: 75, width: 100, height: 50 },
        ]);
        flow.engine.run("set-viewport", { x: -160, y: 0, zoom: 1 });
        expect(flow.engine.get("visible-nodes").map((node) => node.id)).toEqual(
            ["b"],
        );
        expect(
            flow.engine.get("intersecting-nodes", {
                rect: { x: 40, y: 70, width: 20, height: 20 },
            }),
        ).toMatchObject([{ id: "a" }]);
    });

    it("puts the node and edge toolbars beside its box", () => {
        const flow = centred();
        const same = cornered();
        expect(flow.engine.get("node-toolbar-by", { nodeId: "a" })).toEqual({
            x: 100,
            y: 65,
            anchorX: 0.5,
            anchorY: 1,
        });
        expect(
            flow.engine.get("edge-toolbar-by", {
                edgeId: "handles",
                position: "source",
            }),
        ).toEqual(
            same.engine.get("edge-toolbar-by", {
                edgeId: "handles",
                position: "source",
            }),
        );
    });

    it("selects by its box", () => {
        const flow = centred({}, [selection()]);
        dragOn(
            flow.root,
            flow.root,
            [flow.client(40, 70), flow.client(100, 100), flow.client(160, 130)],
            { shiftKey: true },
        );
        expect(flow.model.get("selected-nodes").map((node) => node.id)).toEqual(
            ["a"],
        );
    });

    it("drags it by its position, keeps it in its extent and resizes it from its box", () => {
        const flow = centred(
            { nodeExtent: { x: 0, y: 0, width: 1000, height: 160 } },
            [drag(), resize()],
        );
        dragOn(flow.node("a"), flow.root, [
            flow.client(100, 100),
            flow.client(110, 105),
            flow.client(120, 110),
        ]);
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 120,
            y: 110,
        });
        // down past the extent: the box's bottom edge stops at 160, its centre at 135
        dragOn(flow.node("a"), flow.root, [
            flow.client(120, 110),
            flow.client(120, 200),
            flow.client(120, 400),
        ]);
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 120,
            y: 135,
        });
        const corner = document.createElement("div");
        corner.setAttribute("data-flow-part", "resize-handle");
        corner.setAttribute("data-position", "top-left");
        flow.node("a").append(corner);
        dragOn(corner, flow.root, [flow.client(70, 110), flow.client(50, 100)]);
        // the bottom-right corner (170, 160) stays put, the centre follows the box
        expect(flow.model.get("node-by", { id: "a" })).toMatchObject({
            position: { x: 110, y: 130 },
            width: 120,
            height: 60,
        });
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 50,
            y: 100,
            width: 120,
            height: 60,
        });
    });

    it("moves a parent's box and its children with it; a child's own origin is ignored", () => {
        const flow = mount(
            {
                version: 1,
                nodes: [
                    {
                        id: "p",
                        type: "group",
                        position: { x: 100, y: 100 },
                        origin: CENTRE,
                        data: {},
                    },
                    {
                        id: "c",
                        type: "default",
                        position: { x: 10, y: 10 },
                        parentId: "p",
                        origin: { x: 1, y: 1 },
                        data: {},
                    },
                ],
                edges: [],
            },
            {
                features: [subflows()],
                sizes: { p: [200, 100], c: [20, 20] },
            },
        );
        expect(flow.engine.get("node-rect-by", { nodeId: "p" })).toMatchObject({
            x: 0,
            y: 50,
        });
        expect(flow.engine.get("node-rect-by", { nodeId: "c" })).toEqual({
            x: 10,
            y: 60,
            width: 20,
            height: 20,
        });
        // internal-node-by agrees with node-rect-by (the engine's layout)
        expect(
            flow.engine.get("internal-node-by", { nodeId: "c" })
                ?.absolutePosition,
        ).toEqual({ x: 10, y: 60 });
        expect(
            flow.engine.get("internal-node-by", { nodeId: "p" })
                ?.absolutePosition,
        ).toEqual({ x: 100, y: 100 });
    });
});
