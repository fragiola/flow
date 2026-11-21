import { describe, expect, it } from "vitest";
import { veto } from "../../src/commands/veto";
import { connection } from "../../src/connection/connection";
import { createFlowModel } from "../../src/model/create-flow-model";
import { reconnection } from "../../src/reconnection/reconnection";
import { chain, task } from "../fixture";

const features = [connection(), reconnection()] as const;

describe("reconnection()", () => {
    it("edge.reconnect moves an edge's ends, keeping its id, type and data", () => {
        const json = chain();
        json.edges[0] = {
            id: "ab",
            source: "a",
            target: "b",
            sourceHandle: "out",
            type: "step",
            data: { w: 1 },
        };
        const model = createFlowModel(json, { features });
        expect(
            model.run("edge.reconnect", {
                edgeId: "ab",
                source: "a",
                target: "c",
                targetHandle: "in",
            }),
        ).toEqual({ ok: true, value: { edgeId: "ab" } });
        expect(model.get("edge-by", { id: "ab" })).toEqual({
            id: "ab",
            source: "a",
            target: "c",
            targetHandle: "in",
            type: "step",
            data: { w: 1 },
        });
    });

    it("refuses an edge that is not reconnectable, unconnectable nodes and duplicates", () => {
        const json = chain();
        json.nodes.push(task("locked", 0, 0, { connectable: false }));
        const model = createFlowModel(json, { features });
        expect(
            model.run("edge.reconnect", {
                edgeId: "ab",
                source: "b",
                target: "c",
            }),
        ).toMatchObject({ error: { code: "refused", path: "/source" } });
        expect(
            model.run("edge.reconnect", {
                edgeId: "ab",
                source: "a",
                target: "locked",
            }),
        ).toMatchObject({ error: { code: "refused", path: "/target" } });
        // reconnecting an edge onto its own ends is fine
        expect(
            model.run("edge.reconnect", {
                edgeId: "ab",
                source: "a",
                target: "b",
            }).ok,
        ).toBe(true);
        model.run("edge.set-flags", { edgeId: "ab", reconnectable: false });
        expect(
            model.run("edge.reconnect", {
                edgeId: "ab",
                source: "a",
                target: "c",
            }),
        ).toMatchObject({ error: { code: "refused", path: "/edgeId" } });
        expect(
            model.run("edge.reconnect", {
                edgeId: "zz",
                source: "a",
                target: "c",
            }),
        ).toMatchObject({ error: { code: "not_found", path: "/edgeId" } });
    });

    it("is refused by a middleware's veto, which can answers (D7)", () => {
        const model = createFlowModel(chain(), { features });
        model.use((ctx, next) =>
            ctx.command === "edge.reconnect" && ctx.payload.target === "c"
                ? veto()
                : next(),
        );
        expect(
            model.can("edge.reconnect", {
                edgeId: "ab",
                source: "a",
                target: "c",
            }),
        ).toBe(false);
    });
});
