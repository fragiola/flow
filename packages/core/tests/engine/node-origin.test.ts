// @vitest-environment jsdom
// The `nodeOrigin` engine option: a node's position stands at a share of its box, and every box the
// engine derives goes through it (rects, handles, edge ends, bounds, `fit-view`, `visible-nodes`, the
// minimap, toolbars, the selection box, drag and resize). A child's position stays its box's
// top-left corner inside its parent's box.
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
/** `a` and `b` at these positions, joined by their handles, and back by their default sides. */
const json = (a: [number, number], b: [number, number]): FlowJson =>
    flowOf(
        { a, b },
        {
            edges: [
                {
                    id: "handles",
                    source: "a",
                    sourceHandle: "out",
                    target: "b",
                    targetHandle: "in",
                },
                // `b` has no source handle and `a` no target one
                { id: "sides", source: "b", target: "a" },
            ],
        },
    );

/** The flow with its nodes centred on (100, 100) and (400, 100). */
const centred = <const F extends FlowFeatures = readonly []>(
    engine: FlowEngineOptions = {},
    features?: F,
) =>
    mount(json([100, 100], [400, 100]), {
        features,
        sizes,
        handles,
        engine: { nodeOrigin: CENTRE, ...engine },
    });

/** The same boxes drawn from their top-left corners (the default origin). */
const cornered = (engine: FlowEngineOptions = {}) =>
    mount(json([50, 75], [350, 75]), { sizes, handles, engine });

describe("nodeOrigin", () => {
    it("centres each node's box, its handles and its edges' ends on its position", () => {
        const { engine } = centred();
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 50,
            y: 75,
            width: 100,
            height: 50,
        });
        expect(engine.get("handles-by", { nodeId: "a" })).toMatchObject([
            { handleId: "out", center: { x: 150, y: 100 } },
        ]);
        expect(engine.get("edge-path-by", { edgeId: "handles" })).toMatchObject(
            {
                source: { x: 150, y: 100 },
                target: { x: 350, y: 100 },
            },
        );
        // without handles: the source's bottom middle, the target's top middle
        expect(engine.get("edge-path-by", { edgeId: "sides" })).toMatchObject({
            source: { x: 400, y: 125 },
            target: { x: 100, y: 75 },
        });
    });

    it("gives the bounds, fit-view, visible nodes and the minimap of the centred boxes", () => {
        const flow = centred({}, [minimap()]);
        const same = cornered();
        expect(flow.engine.get("nodes-bounds", {})).toEqual({
            x: 50,
            y: 75,
            width: 400,
            height: 50,
        });
        expect(flow.engine.get("nodes-bounds", {})).toEqual(
            same.engine.get("nodes-bounds", {}),
        );
        expect(flow.engine.run("fit-view", {})).toEqual(
            same.engine.run("fit-view", {}),
        );
        const view = flow.engine.get("minimap-view", {
            width: 200,
            height: 150,
        });
        expect(view.nodes).toEqual([
            { nodeId: "a", x: 50, y: 75, width: 100, height: 50 },
            { nodeId: "b", x: 350, y: 75, width: 100, height: 50 },
        ]);
        expect(view.viewBox).toEqual(
            mount(json([50, 75], [350, 75]), {
                features: [minimap()],
                sizes,
                engine: { defaultViewport: flow.engine.get("viewport") },
            }).engine.get("minimap-view", { width: 200, height: 150 }).viewBox,
        );
        // a view that starts at x = 160 holds `b` and misses `a`'s box (50…150)
        flow.engine.run("set-viewport", { x: -160, y: 0, zoom: 1 });
        expect(flow.engine.get("visible-nodes").map((node) => node.id)).toEqual(
            ["b"],
        );
    });

    it("puts a toolbar beside the centred box", () => {
        const { engine } = centred();
        expect(engine.get("node-toolbar-by", { nodeId: "a" })).toEqual({
            x: 100,
            y: 65,
            anchorX: 0.5,
            anchorY: 1,
        });
    });

    it("selects by the centred boxes", () => {
        const flow = centred({}, [selection()]);
        // a box from (40, 70) to (160, 130) holds a's centred box, not its top-left one
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

    it("drags a node by its position and resizes it from its box", () => {
        const flow = centred({}, [drag(), resize()]);
        dragOn(flow.node("a"), flow.root, [
            flow.client(100, 100),
            flow.client(110, 105),
            flow.client(120, 110),
        ]);
        expect(flow.model.get("node-by", { id: "a" })?.position).toEqual({
            x: 120,
            y: 110,
        });
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toMatchObject({
            x: 70,
            y: 85,
        });
        // from the bottom-right corner: the top-left one stays put, the position follows the centre
        const corner = document.createElement("div");
        corner.setAttribute("data-flow-part", "resize-handle");
        corner.setAttribute("data-position", "bottom-right");
        flow.node("a").append(corner);
        dragOn(corner, flow.root, [
            flow.client(170, 135),
            flow.client(190, 145),
        ]);
        expect(flow.model.get("node-by", { id: "a" })).toMatchObject({
            position: { x: 130, y: 115 },
            width: 120,
            height: 60,
        });
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 70,
            y: 85,
            width: 120,
            height: 60,
        });
    });

    it("follows setOptions, and places a child from its parent's top-left corner", () => {
        const flow = mount(
            {
                version: 1,
                nodes: [
                    {
                        id: "p",
                        type: "group",
                        position: { x: 100, y: 100 },
                        data: {},
                    },
                    {
                        id: "c",
                        type: "default",
                        position: { x: 10, y: 10 },
                        parentId: "p",
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
            x: 100,
            y: 100,
        });
        flow.engine.adapter.setOptions({ nodeOrigin: CENTRE });
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
    });
});
