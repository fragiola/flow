// @vitest-environment jsdom
// z-order within each layer: `node-z-index-by` gives each node's structural `z-index` (its
// `zIndex`, a selected node and its descendants raised with `elevateNodesOnSelect`, a child above
// its parent) and `drawn-edges` the edges in drawing order (by `zIndex`, a selected one raised with
// `elevateEdgesOnSelect`); `zIndex` is a document field of nodes and edges.
import { afterEach, describe, expect, it } from "vitest";
import { createFlowModel } from "../../src/model/create-flow-model";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const tree = () => ({
    version: 1 as const,
    nodes: [
        { id: "p", type: "group", position: { x: 0, y: 0 }, data: {} },
        {
            id: "c",
            type: "default",
            position: { x: 10, y: 10 },
            parentId: "p",
            data: {},
        },
        {
            id: "g",
            type: "default",
            position: { x: 5, y: 5 },
            parentId: "c",
            data: {},
        },
        {
            id: "top",
            type: "default",
            position: { x: 300, y: 0 },
            zIndex: 5,
            data: {},
        },
        { id: "low", type: "default", position: { x: 600, y: 0 }, data: {} },
    ],
    edges: [],
});

const zs = (engine: {
    get(key: "node-z-index-by", payload: { nodeId: string }): number;
}) =>
    Object.fromEntries(
        ["p", "c", "g", "top", "low"].map((nodeId) => [
            nodeId,
            engine.get("node-z-index-by", { nodeId }),
        ]),
    );

describe("the nodes' z-order", () => {
    it("is each node's zIndex, a child always above its parent", () => {
        const { engine } = mount(tree(), { features: [subflows()] });
        expect(zs(engine)).toEqual({ p: 0, c: 1, g: 2, top: 5, low: 0 });
        expect(engine.get("node-z-index-by", { nodeId: "zz" })).toBe(0);
    });

    it("raises a selected node and its descendants above the others", () => {
        const flow = mount(tree(), { features: [subflows(), selection()] });
        flow.model.run("selection.set", { nodeIds: ["p"] });
        const raised = zs(flow.engine);
        expect(raised.p).toBeGreaterThan(raised.top as number);
        expect(raised.c).toBe((raised.p as number) + 1);
        expect(raised.g).toBe((raised.p as number) + 2);
        expect(raised.low).toBe(0);
        // a selected child goes above its parent's other children and the other nodes
        flow.model.run("selection.set", { nodeIds: ["c"] });
        const child = zs(flow.engine);
        expect(child.p).toBe(0);
        expect(child.c).toBeGreaterThan(child.top as number);
        expect(child.g).toBe((child.c as number) + 1);
    });

    it("stays the zIndex with elevateNodesOnSelect off", () => {
        const flow = mount(tree(), {
            features: [subflows(), selection()],
            engine: { elevateNodesOnSelect: false },
        });
        flow.model.run("selection.set", { nodeIds: ["p"] });
        expect(zs(flow.engine)).toEqual({ p: 0, c: 1, g: 2, top: 5, low: 0 });
        flow.engine.adapter.setOptions({ elevateNodesOnSelect: true });
        expect(zs(flow.engine).p).toBeGreaterThan(5);
    });
});

describe("the edges' drawing order", () => {
    const json = () =>
        flowOf(
            { a: [0, 0], b: [200, 0], c: [400, 0], d: [600, 0] },
            {
                edges: [
                    // `d` is never measured
                    { id: "ad", source: "a", target: "d", zIndex: 9 },
                    { id: "ab", source: "a", target: "b", zIndex: 2 },
                    { id: "bc", source: "b", target: "c" },
                    { id: "ac", source: "a", target: "c" },
                    { id: "ca", source: "c", target: "a", zIndex: -1 },
                    { id: "hidden", source: "b", target: "a", hidden: true },
                ],
            },
        );
    const sizes = { a: [100, 50], b: [100, 50], c: [100, 50] } as Record<
        string,
        [number, number]
    >;
    const order = (engine: {
        get(key: "drawn-edges"): readonly { id: string }[];
    }) => engine.get("drawn-edges").map((edge) => edge.id);

    it("draws the shown edges of measured nodes by zIndex, the document's order among equals", () => {
        const flow = mount(json(), { features: [selection()], sizes });
        expect(order(flow.engine)).toEqual(["ca", "bc", "ac", "ab"]);
        // a selected edge keeps its place by default
        flow.model.run("selection.set", { edgeIds: ["bc"] });
        expect(order(flow.engine)).toEqual(["ca", "bc", "ac", "ab"]);
    });

    it("draws a selected edge last with elevateEdgesOnSelect", () => {
        const flow = mount(json(), {
            features: [selection()],
            sizes,
            engine: { elevateEdgesOnSelect: true },
        });
        flow.model.run("selection.set", { edgeIds: ["bc"] });
        expect(order(flow.engine)).toEqual(["ca", "ac", "ab", "bc"]);
    });

    it("draws only the edges in view with onlyRenderVisible", () => {
        const flow = mount(json(), {
            sizes,
            engine: {
                onlyRenderVisible: true,
                defaultViewport: { x: -350, y: 0, zoom: 1 },
            },
        });
        // the view starts at x = 350: every edge that reaches c is in it, ab is not
        expect(order(flow.engine)).toEqual(["ca", "bc", "ac"]);
    });
});

describe("zIndex in the document", () => {
    it("is a number on a node and an edge", () => {
        const json = flowOf(
            { a: [0, 0], b: [10, 0] },
            { edges: [{ id: "ab", source: "a", target: "b", zIndex: 3 }] },
        );
        json.nodes[0] = {
            ...json.nodes[0],
            zIndex: -2,
        } as (typeof json.nodes)[0];
        expect(() => createFlowModel(json)).not.toThrow();
        const bad = flowOf({ a: [0, 0] }) as {
            nodes: Record<string, unknown>[];
        };
        bad.nodes[0] = { ...bad.nodes[0], zIndex: "1" };
        expect(() => createFlowModel(bad as never)).toThrow(/zIndex/);
    });

    it("changed by controlled props, replaces the entity", () => {
        const model = createFlowModel(
            flowOf(
                { a: [0, 0], b: [10, 0] },
                { edges: [{ id: "ab", source: "a", target: "b" }] },
            ),
        );
        const nodes = model
            .get("all-nodes")
            .map((node) => (node.id === "a" ? { ...node, zIndex: 4 } : node));
        const edges = model
            .get("all-edges")
            .map((edge) => ({ ...edge, zIndex: 1 }));
        const commands = model.get("commands-to", { nodes, edges });
        expect(model.run("batch", { commands: [...commands] }).ok).toBe(true);
        expect(model.get("node-by", { id: "a" })?.zIndex).toBe(4);
        expect(model.get("edge-by", { id: "ab" })?.zIndex).toBe(1);
        expect(
            model.get("commands-to", { nodes, edges: model.get("all-edges") }),
        ).toEqual([]);
    });
});
