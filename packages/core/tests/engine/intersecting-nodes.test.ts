// @vitest-environment jsdom
// `intersecting-nodes`: the nodes whose measured (or given) box overlaps a node's box or a
// rectangle, or lies wholly inside it (`partial: false`); hidden nodes, nodes of unknown size and
// the node itself are left out; boxes follow the `nodeOrigin` and sub-flows' absolute positions.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { subflows } from "../../src/subflows/subflows";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const ids = (nodes: readonly { id: string }[]) => nodes.map((node) => node.id);

/**
 * `big` (0, 0, 200 × 200); `inside` (50, 50, 20 × 20) wholly in it; `across` (150, 150, 100 × 100)
 * over its corner; `touching` (200, 0, 50 × 50) on its right side; `far` (500, 500, 10 × 10);
 * `unsized` (10, 10, never measured); `ghost` (60, 60, 10 × 10) hidden.
 */
function scene(origin?: { x: number; y: number }) {
    const json = flowOf({
        big: [0, 0],
        inside: [50, 50],
        across: [150, 150],
        touching: [200, 0],
        far: [500, 500],
        unsized: [10, 10],
        ghost: [60, 60],
    });
    json.nodes = json.nodes.map((node) =>
        node.id === "ghost" ? { ...node, hidden: true } : node,
    );
    return mount(json, {
        sizes: {
            big: [200, 200],
            inside: [20, 20],
            across: [100, 100],
            touching: [50, 50],
            far: [10, 10],
            ghost: [10, 10],
        },
        engine: origin ? { nodeOrigin: origin } : {},
    });
}

describe("intersecting-nodes", () => {
    it("gives the nodes sharing area with a node, the node itself left out", () => {
        const { engine } = scene();
        expect(
            ids(engine.get("intersecting-nodes", { nodeId: "big" })),
        ).toEqual(["inside", "across"]);
        expect(
            ids(engine.get("intersecting-nodes", { nodeId: "inside" })),
        ).toEqual(["big"]);
        expect(engine.get("intersecting-nodes", { nodeId: "far" })).toEqual([]);
    });

    it("partial: false keeps only the nodes wholly inside", () => {
        const { engine } = scene();
        expect(
            ids(
                engine.get("intersecting-nodes", {
                    nodeId: "big",
                    partial: false,
                }),
            ),
        ).toEqual(["inside"]);
        expect(
            engine.get("intersecting-nodes", {
                nodeId: "inside",
                partial: false,
            }),
        ).toEqual([]);
    });

    it("takes a flow rectangle, a point inside a node included", () => {
        const { engine } = scene();
        expect(
            ids(
                engine.get("intersecting-nodes", {
                    rect: { x: 190, y: 10, width: 20, height: 20 },
                }),
            ),
        ).toEqual(["big", "touching"]);
        expect(
            ids(
                engine.get("intersecting-nodes", {
                    rect: { x: 0, y: 0, width: 1000, height: 1000 },
                    partial: false,
                }),
            ),
        ).toEqual(["big", "inside", "across", "touching", "far"]);
        expect(
            ids(
                engine.get("intersecting-nodes", {
                    rect: { x: 55, y: 55, width: 0, height: 0 },
                }),
            ),
        ).toEqual(["big", "inside"]);
    });

    it("leaves out the hidden nodes and those of unknown size", () => {
        const { engine } = scene();
        const found = ids(
            engine.get("intersecting-nodes", {
                rect: { x: 0, y: 0, width: 100, height: 100 },
            }),
        );
        expect(found).not.toContain("ghost");
        expect(found).not.toContain("unsized");
        // an unmeasured node has no box to compare with
        expect(engine.get("intersecting-nodes", { nodeId: "unsized" })).toEqual(
            [],
        );
    });

    it("is empty for a missing node or a payload without an area", () => {
        const { engine } = scene();
        const get = engine.get as (key: string, payload?: unknown) => unknown;
        expect(get("intersecting-nodes", { nodeId: "zz" })).toEqual([]);
        expect(get("intersecting-nodes")).toEqual([]);
        expect(
            get("intersecting-nodes", {
                rect: { x: 0, y: 0, width: -5, height: 5 },
            }),
        ).toEqual([]);
    });

    it("compares the boxes the nodeOrigin places", () => {
        // centred boxes: big spans -100…100 on both axes
        const { engine } = scene({ x: 0.5, y: 0.5 });
        expect(
            ids(
                engine.get("intersecting-nodes", {
                    rect: { x: -100, y: -100, width: 1, height: 1 },
                }),
            ),
        ).toEqual(["big"]);
        // across spans 100…200: it only touches big's corner now
        expect(
            ids(engine.get("intersecting-nodes", { nodeId: "big" })),
        ).toEqual(["inside"]);
    });

    it("places a child at its parent's corner plus its position", () => {
        const json: FlowJson = {
            version: 1,
            nodes: [
                {
                    id: "group",
                    type: "group",
                    position: { x: 1000, y: 1000 },
                    data: {},
                },
                {
                    id: "child",
                    type: "task",
                    position: { x: 10, y: 10 },
                    data: {},
                    parentId: "group",
                },
                {
                    id: "outside",
                    type: "task",
                    position: { x: 10, y: 10 },
                    data: {},
                },
            ],
            edges: [],
        };
        const { engine } = mount(json, {
            features: [subflows()],
            sizes: { group: [300, 300], child: [50, 50], outside: [50, 50] },
        });
        expect(
            ids(engine.get("intersecting-nodes", { nodeId: "child" })),
        ).toEqual(["group"]);
        expect(
            ids(
                engine.get("intersecting-nodes", {
                    nodeId: "group",
                    partial: false,
                }),
            ),
        ).toEqual(["child"]);
        expect(
            ids(engine.get("intersecting-nodes", { nodeId: "outside" })),
        ).toEqual([]);
    });
});
