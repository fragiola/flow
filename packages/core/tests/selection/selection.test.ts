import { describe, expect, it } from "vitest";
import type { AnyTypes } from "../../src/document/types";
import { createFlowModel } from "../../src/model/create-flow-model";
import { selection } from "../../src/selection/selection";
import { subflows } from "../../src/subflows/subflows";
import { chain, task } from "../fixture";

const features = [selection()] as const;

function model(json = chain()) {
    return createFlowModel<AnyTypes, typeof features>(json, { features });
}

const selected = (flow: ReturnType<typeof model>) => ({
    nodeIds: flow.get("selected-nodes").map((node) => node.id),
    edgeIds: flow.get("selected-edges").map((edge) => edge.id),
});

describe("selection()", () => {
    it("selection.set replaces, adds and toggles", () => {
        const flow = model();
        expect(
            flow.run("selection.set", { nodeIds: ["a", "b"], edgeIds: ["ab"] }),
        ).toEqual({
            ok: true,
            value: { nodeIds: ["a", "b"], edgeIds: ["ab"] },
        });
        expect(flow.run("selection.set", { nodeIds: ["c"] }).ok).toBe(true);
        expect(selected(flow)).toEqual({ nodeIds: ["c"], edgeIds: [] });
        flow.run("selection.set", {
            nodeIds: ["a"],
            edgeIds: ["bc"],
            mode: "add",
        });
        expect(selected(flow)).toEqual({
            nodeIds: ["a", "c"],
            edgeIds: ["bc"],
        });
        flow.run("selection.set", { nodeIds: ["a", "b"], mode: "toggle" });
        expect(selected(flow)).toEqual({
            nodeIds: ["b", "c"],
            edgeIds: ["bc"],
        });
        expect(flow.is("node-selected", { nodeId: "b" })).toBe(true);
        expect(flow.is("node-selected", { nodeId: "a" })).toBe(false);
        expect(flow.is("edge-selected", { edgeId: "bc" })).toBe(true);
    });

    it("keeps the selection in the document: flow-json writes it, and only for the selected", () => {
        const flow = model();
        flow.run("selection.set", { nodeIds: ["a"] });
        const json = flow.get("flow-json");
        expect(json.nodes[0]).toMatchObject({ id: "a", selected: true });
        expect(json.nodes[1]).not.toHaveProperty("selected");
        expect(model(json).is("node-selected", { nodeId: "a" })).toBe(true);
        flow.run("selection.clear");
        expect(flow.get("flow-json").nodes[0]).not.toHaveProperty("selected");
    });

    it("only writes the nodes and edges whose selection changes", () => {
        const flow = model();
        flow.run("selection.set", { nodeIds: ["a"] });
        const before = flow.get("all-nodes");
        flow.run("selection.set", { nodeIds: ["a", "b"] });
        const after = flow.get("all-nodes");
        expect(after[0]).toBe(before[0]);
        expect(after[2]).toBe(before[2]);
        expect(after[1]).not.toBe(before[1]);
    });

    it("refuses what is missing or not selectable, with its path", () => {
        const json = chain();
        json.nodes[2] = task("c", 0, 0, { selectable: false });
        const flow = model(json);
        expect(flow.run("selection.set", { nodeIds: ["a", "zz"] })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no node "zz"',
                path: "/nodeIds/1",
            },
        });
        expect(flow.run("selection.set", { nodeIds: ["c"] })).toMatchObject({
            error: { code: "refused", path: "/nodeIds/0" },
        });
        flow.run("edge.set-flags", { edgeId: "ab", selectable: false });
        expect(flow.run("selection.set", { edgeIds: ["ab"] })).toMatchObject({
            error: { code: "refused", path: "/edgeIds/0" },
        });
        expect(flow.run("selection.set", { edgeIds: ["zz"] })).toMatchObject({
            error: { code: "not_found", path: "/edgeIds/0" },
        });
        expect(
            flow.run(
                "node.add",
                task("d", 0, 0, { selected: true, selectable: false }),
            ),
        ).toMatchObject({ error: { code: "refused", path: "/selected" } });
        expect(
            flow.run("edge.add", {
                source: "a",
                target: "c",
                selected: true,
                selectable: false,
            }),
        ).toMatchObject({ error: { code: "refused", path: "/selected" } });
    });

    it("deselects a node or an edge made unselectable", () => {
        const flow = model();
        flow.run("selection.set", { nodeIds: ["a"], edgeIds: ["ab"] });
        flow.run("node.set-flags", { nodeId: "a", selectable: false });
        flow.run("edge.set-flags", { edgeId: "ab", selectable: false });
        expect(selected(flow)).toEqual({ nodeIds: [], edgeIds: [] });
    });

    it("selection.clear deselects everything, returning what was selected", () => {
        const flow = model();
        flow.run("selection.set", { nodeIds: ["a"], edgeIds: ["bc"] });
        expect(flow.run("selection.clear")).toEqual({
            ok: true,
            value: { nodeIds: ["a"], edgeIds: ["bc"] },
        });
        expect(selected(flow)).toEqual({ nodeIds: [], edgeIds: [] });
    });

    it("selection.remove removes what is selected and deletable, with the nodes' edges", () => {
        const json = chain();
        json.nodes[2] = task("c", 0, 0, { deletable: false });
        json.edges.push({ id: "ac", source: "a", target: "c" });
        const flow = model(json);
        flow.run("selection.set", { nodeIds: ["a", "c"], edgeIds: ["bc"] });
        expect(flow.run("selection.remove")).toEqual({
            ok: true,
            value: {
                removedNodeIds: ["a"],
                removedEdgeIds: ["ab", "bc", "ac"],
            },
        });
        expect(flow.get("all-nodes").map((node) => node.id)).toEqual([
            "b",
            "c",
        ]);
        expect(flow.get("all-edges")).toEqual([]);
    });

    it("selection.remove keeps a parent that holds a child that is not deletable", () => {
        const both = [selection(), subflows()] as const;
        const flow = createFlowModel(
            {
                version: 1,
                nodes: [
                    task("group", 0, 0, { selected: true }),
                    task("kept", 0, 0, { parentId: "group", deletable: false }),
                    task("other", 0, 0, { selected: true }),
                    task("child", 0, 0, { parentId: "other" }),
                ],
                edges: [],
            },
            { features: both },
        );
        expect(flow.run("selection.remove")).toEqual({
            ok: true,
            value: { removedNodeIds: ["other", "child"], removedEdgeIds: [] },
        });
    });
});
