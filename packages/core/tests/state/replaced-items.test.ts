// What a commit replaced in place (replaced-items.ts): a move, a resize, a batch of them name their
// nodes, across several commits; an addition or a removal (ids or places change) names none.
import { describe, expect, it } from "vitest";
import { createFlowModel } from "../../src/model/create-flow-model";
import { replacedSince } from "../../src/state/replaced-items";

const model = () =>
    createFlowModel({
        version: 1,
        nodes: ["a", "b", "c"].map((id, i) => ({
            id,
            type: "default",
            position: { x: i * 100, y: 0 },
            data: {},
        })),
        edges: [{ id: "ab", source: "a", target: "b" }],
    });

describe("replacedSince", () => {
    it("names the nodes and edges a commit replaced in place, across commits", () => {
        const flow = model();
        const start = flow.get("all-nodes");
        flow.run("node.move", { nodeId: "b", position: { x: 5, y: 5 } });
        expect(replacedSince(flow.get("all-nodes"), start)).toEqual(
            new Set(["b"]),
        );
        flow.run("batch", {
            commands: [
                {
                    command: "node.move",
                    payload: { nodeId: "a", position: { x: 1, y: 1 } },
                },
                {
                    command: "node.resize",
                    payload: { nodeId: "c", width: 10, height: 10 },
                },
            ],
        });
        expect(replacedSince(flow.get("all-nodes"), start)).toEqual(
            new Set(["a", "b", "c"]),
        );
        const edges = flow.get("all-edges");
        flow.run("edge.set-data", { edgeId: "ab", data: { w: 1 } });
        expect(replacedSince(flow.get("all-edges"), edges)).toEqual(
            new Set(["ab"]),
        );
    });

    it("names none across an addition or a removal, or from an unrelated list", () => {
        const flow = model();
        const start = flow.get("all-nodes");
        flow.run("node.add", {
            id: "d",
            type: "default",
            position: { x: 0, y: 0 },
            data: {},
        });
        expect(replacedSince(flow.get("all-nodes"), start)).toBeUndefined();
        const added = flow.get("all-nodes");
        flow.run("node.remove", { nodeId: "a" });
        expect(replacedSince(flow.get("all-nodes"), added)).toBeUndefined();
        expect(replacedSince(model().get("all-nodes"), start)).toBeUndefined();
    });
});
