import { describe, expect, it } from "vitest";
import { createFlowModel } from "../../src/model/create-flow-model";
import { chain, task } from "../fixture";

describe("node commands", () => {
    it("node.add appends a node, its id given or generated; a taken id is refused", () => {
        const model = createFlowModel(chain());
        expect(model.run("node.add", task("d", 10, 20, { width: 50 }))).toEqual(
            {
                ok: true,
                value: { nodeId: "d" },
            },
        );
        expect(model.get("node-by", { id: "d" })).toEqual(
            task("d", 10, 20, { width: 50 }),
        );
        expect(
            model.run("node.add", {
                type: "task",
                position: { x: 0, y: 0 },
                data: {},
            }),
        ).toEqual({ ok: true, value: { nodeId: "node-1" } });
        expect(model.get("all-nodes").map((node) => node.id)).toEqual([
            "a",
            "b",
            "c",
            "d",
            "node-1",
        ]);
        expect(model.run("node.add", task("a"))).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'a node "a" exists',
                path: "/id",
            },
        });
    });

    it("node.add copies its payload: changing it later changes nothing", () => {
        const model = createFlowModel();
        const items = [1];
        model.run("node.add", task("x", 0, 0, { data: { items } }));
        items.push(2);
        expect(model.get("node-by", { id: "x" })?.data).toEqual({ items: [1] });
    });

    it("node.add refuses a feature's field without the feature", () => {
        const model = createFlowModel();
        expect(
            model.run("node.add", task("x", 0, 0, { parentId: "a" })),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                message:
                    "requires the subflows feature (`@fragiola/flow/subflows`)",
                path: "/parentId",
            },
        });
    });

    it("node.remove removes the node and every edge that touches it, in one step", () => {
        const model = createFlowModel(chain());
        let steps = 0;
        model.subscribe(() => steps++);
        expect(model.run("node.remove", { nodeId: "b" })).toEqual({
            ok: true,
            value: { removedNodeIds: ["b"], removedEdgeIds: ["ab", "bc"] },
        });
        expect(steps).toBe(1);
        expect(model.get("all-edges")).toEqual([]);
        expect(model.get("all-nodes").map((node) => node.id)).toEqual([
            "a",
            "c",
        ]);
    });

    it("node.remove refuses a node that is not deletable", () => {
        const json = chain();
        json.nodes[1] = task("b", 0, 0, { deletable: false });
        const model = createFlowModel(json);
        expect(model.run("node.remove", { nodeId: "b" })).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'node "b" is not deletable',
                path: "/nodeId",
            },
        });
    });

    it("node.move moves a node; one that is not draggable is refused", () => {
        const model = createFlowModel(chain());
        expect(
            model.run("node.move", {
                nodeId: "a",
                position: { x: -5, y: 7.5 },
            }),
        ).toEqual({
            ok: true,
            value: { nodeId: "a", position: { x: -5, y: 7.5 } },
        });
        model.run("node.set-flags", { nodeId: "a", draggable: false });
        expect(
            model.run("node.move", { nodeId: "a", position: { x: 0, y: 0 } }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/nodeId" },
        });
        expect(
            model.run("node.move", { nodeId: "zz", position: { x: 0, y: 0 } }),
        ).toMatchObject({ error: { code: "not_found" } });
    });

    it("node.resize sets the size and, optionally, the position", () => {
        const model = createFlowModel(chain());
        expect(
            model.run("node.resize", { nodeId: "a", width: 100, height: 40 }),
        ).toEqual({
            ok: true,
            value: {
                nodeId: "a",
                width: 100,
                height: 40,
                position: { x: 0, y: 0 },
            },
        });
        expect(
            model.run("node.resize", {
                nodeId: "a",
                width: 80,
                height: 40,
                position: { x: 20, y: 0 },
            }),
        ).toMatchObject({ ok: true, value: { position: { x: 20, y: 0 } } });
        expect(model.get("node-by", { id: "a" })).toMatchObject({
            width: 80,
            height: 40,
        });
        expect(
            model.run("node.resize", { nodeId: "a", width: -1, height: 1 }),
        ).toMatchObject({
            error: { code: "invalid_payload", path: "/width" },
        });
    });

    it("node.set-data merges a shallow patch", () => {
        const json = chain();
        json.nodes[0] = task("a", 0, 0, { data: { title: "A", tags: ["x"] } });
        const model = createFlowModel(json);
        model.run("node.set-data", { nodeId: "a", data: { title: "B" } });
        expect(model.get("node-by", { id: "a" })?.data).toEqual({
            title: "B",
            tags: ["x"],
        });
    });

    it("node.set-flags writes the flags given and keeps the others", () => {
        const model = createFlowModel(chain());
        model.run("node.set-flags", {
            nodeId: "a",
            connectable: false,
            hidden: true,
        });
        model.run("node.set-flags", { nodeId: "a", hidden: false });
        expect(model.get("node-by", { id: "a" })).toMatchObject({
            connectable: false,
            hidden: false,
        });
        expect(model.is("node-connectable", { nodeId: "a" })).toBe(false);
        expect(model.is("node-hidden", { nodeId: "a" })).toBe(false);
    });
});
