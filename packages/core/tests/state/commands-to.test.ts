import { describe, expect, it } from "vitest";
import { connection } from "../../src/connection/index";
import type { FlowEdgeInput, FlowNodeInput } from "../../src/document/types";
import {
    createFlowModel,
    type FlowModel,
} from "../../src/model/create-flow-model";
import { reconnection } from "../../src/reconnection/index";
import { selection } from "../../src/selection/index";
import { subflows } from "../../src/subflows/index";
import { chain, task } from "../fixture";

/** The commands `commands-to` gives, then the document after running them as one batch. */
function sync(
    model: FlowModel,
    target: {
        nodes?: readonly FlowNodeInput[];
        edges?: readonly FlowEdgeInput[];
    },
) {
    const commands = model.get("commands-to", target);
    const result = model.run("batch", { commands: [...commands] });
    return { commands: commands.map((entry) => entry.command), result };
}

describe("commands-to: the commands that bring the document to some nodes and edges", () => {
    it("gives nothing for the document's own lists, or equal copies of them", () => {
        const model = createFlowModel(chain());
        expect(
            model.get("commands-to", {
                nodes: model.get("all-nodes"),
                edges: model.get("all-edges"),
            }),
        ).toEqual([]);
        const json = structuredClone(model.get("flow-json"));
        expect(model.get("commands-to", json)).toEqual([]);
        expect(model.get("commands-to", {})).toEqual([]);
    });

    it("moves, resizes, sets data and flags with the commands a user would run", () => {
        const model = createFlowModel(chain());
        const nodes = [
            task("a", 10, 20, { data: { label: "A" } }),
            task("b", 200, 0, { width: 100, height: 40 }),
            task("c", 400, 0, { deletable: false }),
        ];
        const { commands, result } = sync(model, { nodes });
        expect(result.ok).toBe(true);
        expect(commands).toEqual([
            "node.move",
            "node.set-data",
            "node.resize",
            "node.set-flags",
        ]);
        expect(model.get("commands-to", { nodes })).toEqual([]);
        expect(model.get("node-by", { id: "a" })?.data).toEqual({
            label: "A",
        });
        expect(model.is("node-deletable", { nodeId: "c" })).toBe(false);
    });

    it("adds and removes nodes and edges; a node's edges go with it", () => {
        const model = createFlowModel(chain());
        const { commands, result } = sync(model, {
            nodes: [task("a"), task("b", 200), task("d", 600)],
            edges: [
                { id: "ab", source: "a", target: "b" },
                { id: "bd", source: "b", target: "d" },
            ],
        });
        expect(result.ok).toBe(true);
        // bc goes with c: no edge.remove of its own
        expect(commands).toEqual(["node.add", "node.remove", "edge.add"]);
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual([
            "ab",
            "bd",
        ]);
    });

    it("replaces what no command expresses: a node's type, a removed data key, and its edges", () => {
        const model = createFlowModel({
            version: 1,
            nodes: [task("a", 0, 0, { data: { x: 1 } }), task("b", 200)],
            edges: [{ id: "ab", source: "a", target: "b" }],
        });
        const { commands, result } = sync(model, {
            nodes: [{ ...task("a"), type: "note", data: {} }, task("b", 200)],
            edges: [{ id: "ab", source: "a", target: "b" }],
        });
        expect(result.ok).toBe(true);
        expect(commands).toEqual(["node.remove", "node.add", "edge.add"]);
        expect(model.get("node-by", { id: "a" })?.type).toBe("note");
        expect(model.get("edge-by", { id: "ab" })).toBeDefined();
    });

    it("reconnects with reconnection(), and replaces the edge without it", () => {
        const target = {
            edges: [
                { id: "ab", source: "a", target: "c" },
                { id: "bc", source: "b", target: "c" },
            ],
        };
        const plain = createFlowModel(chain());
        expect(sync(plain, target).commands).toEqual([
            "edge.remove",
            "edge.add",
        ]);
        expect(plain.get("edge-by", { id: "ab" })?.target).toBe("c");
        const withFeature = createFlowModel(chain(), {
            features: [connection(), reconnection()],
        });
        expect(sync(withFeature, target).commands).toEqual(["edge.reconnect"]);
        expect(withFeature.get("edge-by", { id: "ab" })?.target).toBe("c");
    });

    it("sets the selection with selection() when it differs", () => {
        const model = createFlowModel(chain(), { features: [selection()] });
        const nodes = model
            .get("all-nodes")
            .map((node) =>
                node.id === "b" ? { ...node, selected: true } : node,
            );
        expect(sync(model, { nodes }).commands).toEqual(["selection.set"]);
        expect(model.is("node-selected", { nodeId: "b" })).toBe(true);
        expect(model.get("commands-to", { nodes })).toEqual([]);
    });

    it("puts nodes into a parent with subflows(), parents added first", () => {
        const model = createFlowModel(chain(), { features: [subflows()] });
        const { commands, result } = sync(model, {
            nodes: [
                task("a"),
                task("b", 200, 0, { parentId: "g" }),
                task("c", 400),
                task("k", 10, 10, { parentId: "g" }),
                task("g", 100, 0),
            ],
        });
        expect(result.ok).toBe(true);
        expect(commands).toEqual([
            "node.add",
            "node.add",
            "node.set-parent",
            "node.move",
        ]);
        expect(model.get("node-by", { id: "b" })?.parentId).toBe("g");
        expect(model.get("node-by", { id: "b" })?.position).toEqual({
            x: 200,
            y: 0,
        });
    });

    it("unlocks what the flags stop a user from, for the step only: the props are the app's", () => {
        const model = createFlowModel({
            version: 1,
            nodes: [
                task("a", 0, 0, { draggable: false, deletable: false }),
                task("b", 200, 0, { connectable: false }),
                task("c", 400, 0),
                task("d", 600, 0, { deletable: false }),
            ],
            edges: [{ id: "bc", source: "b", target: "c", deletable: false }],
        });
        const nodes = [
            task("a", 5, 5, { draggable: false, deletable: false }),
            task("b", 200, 0, { connectable: false }),
            task("c", 400, 0),
        ];
        const { commands, result } = sync(model, {
            nodes,
            edges: [{ id: "ab", source: "a", target: "b" }],
        });
        expect(result.ok).toBe(true);
        expect(commands).toEqual([
            "edge.set-flags",
            "edge.remove",
            "node.set-flags",
            "node.move",
            "node.set-flags",
            // d is not deletable
            "node.set-flags",
            "node.remove",
            "node.set-flags",
            "edge.add",
            "node.set-flags",
        ]);
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 5,
            y: 5,
        });
        expect(model.is("node-draggable", { nodeId: "a" })).toBe(false);
        expect(model.is("node-connectable", { nodeId: "b" })).toBe(false);
        expect(model.get("commands-to", { nodes })).toEqual([]);
        // made draggable in the same step: the flag goes first, nothing to unlock
        expect(
            sync(model, {
                nodes: [
                    task("a", 9, 9, { draggable: true }),
                    ...nodes.slice(1),
                ],
            }).commands,
        ).toEqual(["node.set-flags", "node.move"]);
    });

    it("lets an edge the app does not control go with its removed node", () => {
        const model = createFlowModel(chain());
        const { commands, result } = sync(model, {
            nodes: [task("a"), task("b", 200)],
        });
        expect(result.ok).toBe(true);
        expect(commands).toEqual(["node.remove"]);
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual(["ab"]);
    });
});
