// `incomers-by` and `outgoers-by`: the nodes at the other end of a node's incoming and outgoing
// edges, in the document's node order, each once, on a cycle, a self loop, parallel edges, hidden
// entities and a sub-flow.
import { describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { createFlowModel } from "../../src/model/create-flow-model";
import { subflows } from "../../src/subflows/subflows";
import { task } from "../fixture";

/** d, a, b, c (document order) with a → b → c → a (a cycle), a → c, c → c (a self loop). */
function graph(): FlowJson {
    return {
        version: 1,
        nodes: [task("d"), task("a"), task("b"), task("c")],
        edges: [
            { id: "ab", source: "a", target: "b" },
            { id: "bc", source: "b", target: "c" },
            { id: "ca", source: "c", target: "a" },
            { id: "ac", source: "a", target: "c" },
            // a second edge a → b between other handles: b is still once
            {
                id: "ab2",
                source: "a",
                target: "b",
                sourceHandle: "out2",
                targetHandle: "in2",
            },
            { id: "cc", source: "c", target: "c" },
        ],
    };
}

const ids = (nodes: readonly { id: string }[]) => nodes.map((node) => node.id);

describe("incomers-by and outgoers-by", () => {
    it("give the nodes at the other end, in the document's node order, each once", () => {
        const model = createFlowModel(graph());
        expect(ids(model.get("incomers-by", { nodeId: "a" }))).toEqual(["c"]);
        expect(ids(model.get("outgoers-by", { nodeId: "a" }))).toEqual([
            "b",
            "c",
        ]);
        expect(ids(model.get("incomers-by", { nodeId: "b" }))).toEqual(["a"]);
        expect(ids(model.get("outgoers-by", { nodeId: "b" }))).toEqual(["c"]);
        // the edges come b → c and a → c, but a is before b in the document
        expect(ids(model.get("incomers-by", { nodeId: "c" }))).toEqual([
            "a",
            "b",
            "c",
        ]);
    });

    it("a self loop makes a node its own incomer and outgoer", () => {
        const model = createFlowModel(graph());
        expect(ids(model.get("outgoers-by", { nodeId: "c" }))).toEqual([
            "a",
            "c",
        ]);
        expect(ids(model.get("incomers-by", { nodeId: "c" }))).toContain("c");
    });

    it("a node without edges, a missing node and a bad payload have none", () => {
        const model = createFlowModel(graph());
        expect(model.get("incomers-by", { nodeId: "d" })).toEqual([]);
        expect(model.get("outgoers-by", { nodeId: "d" })).toEqual([]);
        expect(model.get("outgoers-by", { nodeId: "zz" })).toEqual([]);
        const get = model.get as (key: string, payload?: unknown) => unknown;
        expect(get("incomers-by")).toEqual([]);
        expect(get("outgoers-by", { nodeId: 3 })).toEqual([]);
    });

    it("hidden nodes and edges count: a graph fact, not a view's", () => {
        const json = graph();
        json.nodes = json.nodes.map((node) =>
            node.id === "b" ? { ...node, hidden: true } : node,
        );
        json.edges = json.edges.map((edge) =>
            edge.id === "ac" ? { ...edge, hidden: true } : edge,
        );
        const model = createFlowModel(json);
        expect(ids(model.get("outgoers-by", { nodeId: "a" }))).toEqual([
            "b",
            "c",
        ]);
    });

    it("gives the model's own nodes, and follows the document", () => {
        const model = createFlowModel(graph());
        const [b] = model.get("outgoers-by", { nodeId: "a" });
        expect(b).toBe(model.get("node-by", { id: "b" }));
        model.run("edge.remove", { edgeId: "ca" });
        expect(model.get("incomers-by", { nodeId: "a" })).toEqual([]);
    });

    it("in a sub-flow, a parent is no neighbour of its child unless an edge joins them", () => {
        const model = createFlowModel(
            {
                version: 1,
                nodes: [
                    task("group"),
                    task("x", 10, 10, { parentId: "group" }),
                    task("y", 50, 10, { parentId: "group" }),
                    task("out", 300),
                ],
                edges: [
                    { id: "xy", source: "x", target: "y" },
                    { id: "y-out", source: "y", target: "out" },
                    { id: "group-x", source: "group", target: "x" },
                ],
            },
            { features: [subflows()] },
        );
        expect(ids(model.get("outgoers-by", { nodeId: "y" }))).toEqual([
            "out",
        ]);
        expect(ids(model.get("incomers-by", { nodeId: "y" }))).toEqual(["x"]);
        expect(ids(model.get("incomers-by", { nodeId: "x" }))).toEqual([
            "group",
        ]);
        expect(ids(model.get("outgoers-by", { nodeId: "group" }))).toEqual([
            "x",
        ]);
    });
});
