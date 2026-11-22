import { describe, expect, it } from "vitest";
import { createFlowModel } from "../../src/model/create-flow-model";
import { chain, task } from "../fixture";

describe("the core's keys", () => {
    it("node-by, edge-by, all-nodes, all-edges", () => {
        const model = createFlowModel(chain());
        expect(model.get("node-by", { id: "b" })?.position).toEqual({
            x: 200,
            y: 0,
        });
        expect(model.get("node-by", { id: "zz" })).toBeUndefined();
        expect(model.get("edge-by", { id: "bc" })?.target).toBe("c");
        expect(model.get("all-nodes")).toHaveLength(3);
        expect(model.get("all-edges")).toHaveLength(2);
        const get = model.get as (key: string, payload?: unknown) => unknown;
        expect(get("node-by", { id: 1 })).toBeUndefined();
        expect(get("node-by")).toBeUndefined();
        expect(get("no-such-key")).toBeUndefined();
    });

    it("node-edges-by: a node's edges, by end and by handle", () => {
        const json = chain();
        json.edges.push(
            { id: "ba", source: "b", target: "a", sourceHandle: "back" },
            { id: "cb", source: "c", target: "b", targetHandle: "side" },
        );
        const model = createFlowModel(json);
        const ids = (
            payload: Parameters<typeof model.get<"node-edges-by">>[1],
        ) => model.get("node-edges-by", payload).map((edge) => edge.id);
        expect(ids({ nodeId: "b" })).toEqual(["ab", "bc", "ba", "cb"]);
        expect(ids({ nodeId: "b", handleType: "source" })).toEqual([
            "bc",
            "ba",
        ]);
        expect(ids({ nodeId: "b", handleType: "target" })).toEqual([
            "ab",
            "cb",
        ]);
        expect(ids({ nodeId: "b", handleId: "back" })).toEqual(["ba"]);
        expect(
            ids({ nodeId: "b", handleType: "target", handleId: "side" }),
        ).toEqual(["cb"]);
        expect(ids({ nodeId: "zz" })).toEqual([]);
    });

    it("connected-edges-by: the edges that touch any of the nodes, once", () => {
        const model = createFlowModel(chain());
        expect(
            model
                .get("connected-edges-by", { nodeIds: ["a", "b"] })
                .map((edge) => edge.id),
        ).toEqual(["ab", "bc"]);
        expect(
            model
                .get("connected-edges-by", { nodeIds: ["c"] })
                .map((edge) => edge.id),
        ).toEqual(["bc"]);
        expect(model.get("connected-edges-by", { nodeIds: [] })).toEqual([]);
    });

    it("absolute-position-by: a node's own position without sub-flows", () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a", 3, 4)],
            edges: [],
        });
        expect(model.get("absolute-position-by", { nodeId: "a" })).toEqual({
            x: 3,
            y: 4,
        });
        expect(
            model.get("absolute-position-by", { nodeId: "zz" }),
        ).toBeUndefined();
    });

    it("commands: every installed command with its description, schemas and transient flag", () => {
        const model = createFlowModel();
        const commands = model.get("commands");
        expect(commands.map((info) => info.name)).toEqual([
            "node.add",
            "node.remove",
            "node.move",
            "node.resize",
            "node.set-data",
            "node.set-flags",
            "node.set-z-index",
            "edge.add",
            "edge.remove",
            "edge.set-data",
            "edge.set-flags",
            "edge.set-z-index",
            "batch",
        ]);
        for (const info of commands) {
            expect(info.description.length).toBeGreaterThan(10);
            expect(info.payloadSchema.type).toBe("object");
            expect(info.resultSchema.type).toBe("object");
            expect(JSON.stringify(info.payloadSchema)).not.toContain("$ref");
        }
        expect(
            commands.find((info) => info.name === "node.move")?.transient,
        ).toBe(true);
        expect(
            commands.find((info) => info.name === "node.add")?.transient,
        ).toBe(false);
        expect(Object.isFrozen(commands)).toBe(true);
    });

    it("the node is keys read the flags with their defaults", () => {
        const model = createFlowModel({
            version: 1,
            nodes: [
                task("a"),
                task("b", 0, 0, { draggable: false, hidden: true }),
            ],
            edges: [],
        });
        expect(model.is("node-draggable", { nodeId: "a" })).toBe(true);
        expect(model.is("node-selectable", { nodeId: "a" })).toBe(true);
        expect(model.is("node-deletable", { nodeId: "a" })).toBe(true);
        expect(model.is("node-hidden", { nodeId: "a" })).toBe(false);
        expect(model.is("node-draggable", { nodeId: "b" })).toBe(false);
        expect(model.is("node-hidden", { nodeId: "b" })).toBe(true);
        expect(model.is("node-draggable", { nodeId: "zz" })).toBe(false);
    });
});
