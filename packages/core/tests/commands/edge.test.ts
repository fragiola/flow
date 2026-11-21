import { describe, expect, it } from "vitest";
import { createFlowModel } from "../../src/model/create-flow-model";
import { chain, task } from "../fixture";

describe("edge commands", () => {
    it("edge.add joins two nodes, with handles, type and data", () => {
        const model = createFlowModel(chain());
        expect(
            model.run("edge.add", {
                source: "a",
                target: "c",
                sourceHandle: "out",
                targetHandle: "in",
                type: "step",
                data: { weight: 1 },
            }),
        ).toEqual({ ok: true, value: { edgeId: "edge-1" } });
        expect(model.get("edge-by", { id: "edge-1" })).toEqual({
            id: "edge-1",
            source: "a",
            target: "c",
            sourceHandle: "out",
            targetHandle: "in",
            type: "step",
            data: { weight: 1 },
        });
        // a self loop is the app's to forbid (a middleware)
        expect(model.run("edge.add", { source: "a", target: "a" }).ok).toBe(
            true,
        );
    });

    it("edge.add refuses missing nodes, unconnectable nodes, a second edge between the same handles, a taken id", () => {
        const json = chain();
        json.nodes.push(task("locked", 0, 0, { connectable: false }));
        const model = createFlowModel(json);
        expect(model.run("edge.add", { source: "a", target: "zz" })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no node "zz"',
                path: "/target",
            },
        });
        expect(
            model.run("edge.add", { source: "locked", target: "a" }),
        ).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'node "locked" is not connectable',
                path: "/source",
            },
        });
        expect(model.run("edge.add", { source: "a", target: "b" })).toEqual({
            ok: false,
            error: {
                code: "refused",
                message: 'edge "ab" already joins these handles',
                path: "/source",
            },
        });
        // other handles, or the other direction, are another edge
        expect(
            model.run("edge.add", {
                source: "a",
                target: "b",
                sourceHandle: "2",
            }).ok,
        ).toBe(true);
        expect(model.run("edge.add", { source: "b", target: "a" }).ok).toBe(
            true,
        );
        expect(
            model.run("edge.add", { id: "ab", source: "a", target: "c" }),
        ).toMatchObject({
            error: { code: "refused", path: "/id" },
        });
    });

    it("edge.add refuses a feature's field without the feature", () => {
        const model = createFlowModel(chain());
        expect(
            model.run("edge.add", { source: "a", target: "c", selected: true }),
        ).toMatchObject({
            error: { code: "invalid_payload", path: "/selected" },
        });
    });

    it("edge.remove removes an edge; one that is not deletable is refused", () => {
        const model = createFlowModel(chain());
        expect(model.run("edge.remove", { edgeId: "ab" })).toEqual({
            ok: true,
            value: { edgeId: "ab" },
        });
        expect(model.get("all-edges").map((edge) => edge.id)).toEqual(["bc"]);
        model.run("edge.set-flags", { edgeId: "bc", deletable: false });
        expect(model.run("edge.remove", { edgeId: "bc" })).toMatchObject({
            error: { code: "refused", path: "/edgeId" },
        });
        expect(model.run("edge.remove", { edgeId: "zz" })).toMatchObject({
            error: { code: "not_found", path: "/edgeId" },
        });
    });

    it("edge.set-data merges a shallow patch, also into an edge without data", () => {
        const model = createFlowModel(chain());
        model.run("edge.set-data", { edgeId: "ab", data: { label: 1 } });
        model.run("edge.set-data", { edgeId: "ab", data: { weight: 2 } });
        expect(model.get("edge-by", { id: "ab" })?.data).toEqual({
            label: 1,
            weight: 2,
        });
    });

    it("edge.set-flags writes the flags given; the is keys read them with their defaults", () => {
        const model = createFlowModel(chain());
        expect(model.is("edge-reconnectable", { edgeId: "ab" })).toBe(true);
        expect(model.is("edge-hidden", { edgeId: "ab" })).toBe(false);
        model.run("edge.set-flags", {
            edgeId: "ab",
            reconnectable: false,
            hidden: true,
        });
        expect(model.is("edge-reconnectable", { edgeId: "ab" })).toBe(false);
        expect(model.is("edge-hidden", { edgeId: "ab" })).toBe(true);
        expect(model.is("edge-selectable", { edgeId: "ab" })).toBe(true);
        expect(model.is("edge-deletable", { edgeId: "zz" })).toBe(false);
    });
});
