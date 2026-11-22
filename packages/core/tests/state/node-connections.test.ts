// `node-connections-by` (a node's edges as connections, by handle type and handle id) and
// `nodes-data-by` (the id, type and data of nodes, in the order asked): what the adapters' hooks
// `useNodeConnections` and `useNodesData` read.
import { describe, expect, it } from "vitest";
import type { FlowJson } from "../../src/document/types";
import { createFlowModel } from "../../src/model/create-flow-model";
import { task } from "../fixture";

/** p feeds m twice (two handles of m), m feeds q. */
function graph(): FlowJson {
    return {
        version: 1,
        nodes: [
            task("p", 0, 0, { data: { label: "P" } }),
            task("m", 200, 0, { data: { label: "M" } }),
            { id: "q", type: "note", position: { x: 400, y: 0 }, data: {} },
        ],
        edges: [
            { id: "pm1", source: "p", target: "m", targetHandle: "left" },
            { id: "pm2", source: "p", target: "m", targetHandle: "top" },
            { id: "mq", source: "m", target: "q", sourceHandle: "out" },
        ],
    };
}

describe("node-connections-by", () => {
    it("gives every edge at a node as its id and ends, in the document's order", () => {
        const model = createFlowModel(graph());
        expect(model.get("node-connections-by", { nodeId: "m" })).toEqual([
            {
                edgeId: "pm1",
                source: "p",
                sourceHandle: undefined,
                target: "m",
                targetHandle: "left",
            },
            {
                edgeId: "pm2",
                source: "p",
                sourceHandle: undefined,
                target: "m",
                targetHandle: "top",
            },
            {
                edgeId: "mq",
                source: "m",
                sourceHandle: "out",
                target: "q",
                targetHandle: undefined,
            },
        ]);
    });

    it("keeps those of a handle type, and of a handle", () => {
        const model = createFlowModel(graph());
        const edgeIds = (payload: {
            nodeId: string;
            handleType?: "source" | "target";
            handleId?: string;
        }) =>
            model
                .get("node-connections-by", payload)
                .map((connection) => connection.edgeId);
        expect(edgeIds({ nodeId: "m", handleType: "target" })).toEqual([
            "pm1",
            "pm2",
        ]);
        expect(edgeIds({ nodeId: "m", handleType: "source" })).toEqual(["mq"]);
        expect(
            edgeIds({ nodeId: "m", handleType: "target", handleId: "top" }),
        ).toEqual(["pm2"]);
        expect(edgeIds({ nodeId: "nobody" })).toEqual([]);
    });
});

describe("nodes-data-by", () => {
    it("gives each node's id, type and data in the order asked, leaving unknown ids out", () => {
        const model = createFlowModel(graph());
        expect(
            model.get("nodes-data-by", { nodeIds: ["q", "gone", "p"] }),
        ).toEqual([
            { id: "q", type: "note", data: {} },
            { id: "p", type: "task", data: { label: "P" } },
        ]);
        expect(model.get("nodes-data-by", { nodeIds: [] })).toEqual([]);
    });

    it("hands out the document's own data object", () => {
        const model = createFlowModel(graph());
        const [entry] = model.get("nodes-data-by", { nodeIds: ["m"] });
        expect(entry?.data).toBe(model.get("node-by", { id: "m" })?.data);
    });
});
