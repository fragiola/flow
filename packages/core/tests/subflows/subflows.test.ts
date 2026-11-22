import { describe, expect, it } from "vitest";
import { createFlowModel } from "../../src/model/create-flow-model";
import { subflows } from "../../src/subflows/subflows";
import { task } from "../fixture";

const features = [subflows()] as const;

/** A group at (100, 100), 200 × 100, holding `a` (20 × 10) at (10, 10), which holds `b`. */
function model(extra: object = {}) {
    return createFlowModel(
        {
            version: 1,
            nodes: [
                task("group", 100, 100, { width: 200, height: 100 }),
                task("a", 10, 10, {
                    parentId: "group",
                    width: 20,
                    height: 10,
                    ...extra,
                }),
                task("b", 5, 5, { parentId: "a" }),
                task("free", 500, 500),
            ],
            edges: [
                { id: "ab", source: "a", target: "b" },
                { id: "free-group", source: "free", target: "group" },
            ],
        },
        { features },
    );
}

describe("subflows()", () => {
    it("reads children, parents and absolute positions", () => {
        const flow = model();
        expect(
            flow
                .get("node-children-by", { nodeId: "group" })
                .map((node) => node.id),
        ).toEqual(["a"]);
        expect(flow.get("node-parent-by", { nodeId: "b" })?.id).toBe("a");
        expect(flow.get("node-parent-by", { nodeId: "group" })).toBeUndefined();
        expect(flow.get("absolute-position-by", { nodeId: "b" })).toEqual({
            x: 115,
            y: 115,
        });
    });

    it("removing a parent removes its children and every edge they touch, in one step", () => {
        const flow = model();
        let steps = 0;
        flow.subscribe(() => steps++);
        expect(flow.run("node.remove", { nodeId: "group" })).toEqual({
            ok: true,
            value: {
                removedNodeIds: ["group", "a", "b"],
                removedEdgeIds: ["ab", "free-group"],
            },
        });
        expect(steps).toBe(1);
        expect(flow.get("all-nodes").map((node) => node.id)).toEqual(["free"]);
    });

    it("refuses removing a parent that holds a node that is not deletable", () => {
        const flow = model({ deletable: false });
        expect(flow.run("node.remove", { nodeId: "group" })).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'node "group" holds node "a", which is not deletable',
                path: "/nodeId",
            },
        });
    });

    it("keeps a node with extent parent inside its parent's box", () => {
        const flow = model({ extent: "parent" });
        expect(
            flow.run("node.move", {
                nodeId: "a",
                position: { x: 500, y: -20 },
            }),
        ).toEqual({
            ok: true,
            value: { nodeId: "a", position: { x: 180, y: 0 } },
        });
        expect(
            flow.run("node.resize", {
                nodeId: "a",
                width: 50,
                height: 10,
                position: { x: 190, y: 5 },
            }),
        ).toMatchObject({ value: { position: { x: 150, y: 5 } } });
        // without extent, a child moves freely
        const free = model();
        expect(
            free.run("node.move", {
                nodeId: "a",
                position: { x: 500, y: -20 },
            }),
        ).toMatchObject({ value: { position: { x: 500, y: -20 } } });
    });

    it("grows the parent of a node with expandParent, keeping everything else in place", () => {
        const flow = model({ expandParent: true });
        flow.run("node.move", { nodeId: "a", position: { x: 250, y: 20 } });
        expect(flow.get("node-by", { id: "group" })).toMatchObject({
            position: { x: 100, y: 100 },
            width: 270,
            height: 100,
        });
        // the result is where it ended: the grown parent shifted it
        expect(
            flow.run("node.move", {
                nodeId: "a",
                position: { x: -30, y: -10 },
            }),
        ).toEqual({
            ok: true,
            value: { nodeId: "a", position: { x: 0, y: 0 } },
        });
        expect(flow.get("node-by", { id: "group" })).toMatchObject({
            position: { x: 70, y: 90 },
            width: 300,
            height: 110,
        });
        expect(flow.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
        expect(flow.get("absolute-position-by", { nodeId: "a" })).toEqual({
            x: 70,
            y: 90,
        });
    });

    it("node.set-parent keeps the node's place on screen", () => {
        const flow = model();
        expect(
            flow.run("node.set-parent", { nodeId: "free", parentId: "a" }),
        ).toEqual({
            ok: true,
            value: { nodeId: "free", position: { x: 390, y: 390 } },
        });
        expect(flow.get("absolute-position-by", { nodeId: "free" })).toEqual({
            x: 500,
            y: 500,
        });
        expect(
            flow.run("node.set-parent", { nodeId: "b", parentId: null }),
        ).toMatchObject({ value: { position: { x: 115, y: 115 } } });
        expect(flow.get("node-by", { id: "b" })).not.toHaveProperty("parentId");
    });

    it("node.set-parent sets the extent, clears it with null, and drops it without a parent", () => {
        const flow = model();
        flow.run("node.set-parent", {
            nodeId: "free",
            parentId: "group",
            extent: "parent",
            expandParent: false,
        });
        expect(flow.get("node-by", { id: "free" })).toMatchObject({
            parentId: "group",
            extent: "parent",
            expandParent: false,
            position: { x: 200, y: 100 },
        });
        flow.run("node.set-parent", {
            nodeId: "free",
            parentId: "group",
            extent: null,
        });
        expect(flow.get("node-by", { id: "free" })).not.toHaveProperty(
            "extent",
        );
        flow.run("node.set-parent", { nodeId: "a", parentId: null });
        expect(flow.get("node-by", { id: "a" })).not.toHaveProperty("extent");
    });

    it("node.set-parent sets a rectangle extent, kept without a parent", () => {
        const flow = model();
        const extent = { x: 0, y: 0, width: 50, height: 40 };
        flow.run("node.set-parent", {
            nodeId: "free",
            parentId: "group",
            extent,
        });
        expect(flow.get("node-by", { id: "free" })?.extent).toEqual(extent);
        flow.run("node.set-parent", { nodeId: "free", parentId: null });
        expect(flow.get("node-by", { id: "free" })?.extent).toEqual(extent);
        // controlled props with the same rectangle (a new object) change nothing
        const nodes = flow
            .get("all-nodes")
            .map((node) =>
                node.id === "free" ? { ...node, extent: { ...extent } } : node,
            );
        expect(flow.get("commands-to", { nodes })).toEqual([]);
        expect(
            flow.run("node.set-parent", {
                nodeId: "free",
                parentId: null,
                extent: { x: 0, y: 0, width: -1, height: 0 },
            }).ok,
        ).toBe(false);
    });

    it("node.set-parent refuses a cycle and a missing parent", () => {
        const flow = model();
        expect(
            flow.run("node.set-parent", { nodeId: "group", parentId: "b" }),
        ).toMatchObject({
            error: { code: "refused", path: "/parentId" },
        });
        expect(
            flow.run("node.set-parent", { nodeId: "a", parentId: "a" }),
        ).toMatchObject({
            error: { code: "refused", path: "/parentId" },
        });
        expect(
            flow.run("node.set-parent", { nodeId: "a", parentId: "zz" }),
        ).toMatchObject({
            error: { code: "not_found", path: "/parentId" },
        });
    });

    it("node.add checks the parent", () => {
        const flow = model();
        expect(
            flow.run("node.add", task("x", 0, 0, { parentId: "zz" })),
        ).toMatchObject({
            error: { code: "not_found", path: "/parentId" },
        });
        expect(
            flow.run("node.add", task("x", 0, 0, { parentId: "x" })),
        ).toMatchObject({
            error: { code: "refused", path: "/parentId" },
        });
        expect(
            flow.run(
                "node.add",
                task("x", 999, 0, { parentId: "group", extent: "parent" }),
            ),
        ).toEqual({ ok: true, value: { nodeId: "x" } });
        expect(flow.get("node-by", { id: "x" })?.position).toEqual({
            x: 200,
            y: 0,
        });
    });
});
