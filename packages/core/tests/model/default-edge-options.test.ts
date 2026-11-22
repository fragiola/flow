// The document and model additions of #32: the `defaultEdgeOptions` model option (filled in by
// `edge.add` where its payload leaves a field out, before the middleware sees it), the `focusable`
// flags and `reconnectable`'s end names, in the document, the flag commands and `commands-to`.
import { describe, expect, it } from "vitest";
import { connection } from "../../src/connection/connection";
import { validateFlow } from "../../src/document/validate-flow";
import { createFlowModel } from "../../src/model/create-flow-model";
import { reconnection } from "../../src/reconnection/reconnection";
import { selection } from "../../src/selection/selection";
import { flowOf } from "../engine/harness";

const nodes = () => flowOf({ a: [0, 0], b: [100, 0], c: [200, 0] });

describe("defaultEdgeOptions", () => {
    it("fills what edge.add leaves out, before the middleware", () => {
        const model = createFlowModel(nodes(), {
            defaultEdgeOptions: {
                type: "smoothstep",
                data: { weight: 1 },
                deletable: false,
            },
        });
        const seen: unknown[] = [];
        model.use((ctx, next) => {
            seen.push(ctx.payload);
            return next();
        });
        model.run("edge.add", { id: "e", source: "a", target: "b" });
        expect(model.get("edge-by", { id: "e" })).toEqual({
            id: "e",
            source: "a",
            target: "b",
            type: "smoothstep",
            data: { weight: 1 },
            deletable: false,
        });
        expect(seen[0]).toMatchObject({ type: "smoothstep" });
        // what the payload gives wins
        model.run("edge.add", {
            id: "f",
            source: "b",
            target: "c",
            type: "straight",
            deletable: true,
        });
        expect(model.get("edge-by", { id: "f" })).toMatchObject({
            type: "straight",
            deletable: true,
            data: { weight: 1 },
        });
        // a batch's steps too
        model.run("batch", {
            commands: [
                {
                    command: "edge.add",
                    payload: { id: "g", source: "a", target: "c" },
                },
            ],
        });
        expect(model.get("edge-by", { id: "g" })?.type).toBe("smoothstep");
    });

    it("lets commands-to sync a controlled edge once, not forever", () => {
        const model = createFlowModel(nodes(), {
            defaultEdgeOptions: { type: "smoothstep", deletable: false },
        });
        const edge = { id: "e", source: "a", target: "b", data: {} };
        const wanted = [edge];
        const first = model.get("commands-to", { edges: wanted });
        expect(first.map((command) => command.command)).toEqual(["edge.add"]);
        model.run("batch", { commands: [...first] });
        expect(model.get("commands-to", { edges: wanted })).toEqual([]);
        // what the app gives still wins over the defaults
        expect(
            model.get("commands-to", {
                edges: [{ ...edge, deletable: true }],
            }),
        ).toEqual([
            {
                command: "edge.set-flags",
                payload: { edgeId: "e", deletable: true },
            },
        ]);
    });

    it("leaves the document's edges as they are", () => {
        const model = createFlowModel(
            { ...nodes(), edges: [{ id: "e", source: "a", target: "b" }] },
            { defaultEdgeOptions: { type: "step" } },
        );
        expect(model.get("edge-by", { id: "e" })?.type).toBeUndefined();
    });

    it("refuses ends, ids and fields the edge schema refuses", () => {
        expect(() =>
            createFlowModel(nodes(), {
                defaultEdgeOptions: { source: "a" } as never,
            }),
        ).toThrow(/cannot set "source"/);
        expect(() =>
            createFlowModel(nodes(), {
                defaultEdgeOptions: { zIndex: 1.5 },
            }),
        ).toThrow(TypeError);
        expect(() =>
            createFlowModel(nodes(), {
                defaultEdgeOptions: { colour: "red" } as never,
            }),
        ).toThrow(/not valid/);
    });

    it("lets a connection's dry runs see the defaults", () => {
        const model = createFlowModel(nodes(), {
            features: [selection()],
            defaultEdgeOptions: { selectable: false, selected: true },
        });
        // a selected edge that is not selectable: refused, in a dry run as in a run
        expect(model.can("edge.add", { source: "a", target: "b" })).toBe(false);
    });
});

describe("the focusable flag and reconnectable's ends", () => {
    it("are document fields with their schema", () => {
        expect(
            validateFlow({
                ...nodes(),
                nodes: [{ ...nodes().nodes[0], focusable: false }],
                edges: [
                    {
                        source: "a",
                        target: "a",
                        reconnectable: "target",
                        focusable: false,
                    },
                ],
            } as never),
        ).toEqual([]);
        expect(
            validateFlow({
                ...nodes(),
                edges: [{ source: "a", target: "b", reconnectable: "both" }],
            } as never).map((issue) => issue.path),
        ).toEqual(["/edges/0/reconnectable"]);
    });

    it("are set by the flag commands and synced by commands-to", () => {
        const model = createFlowModel(
            { ...nodes(), edges: [{ id: "e", source: "a", target: "b" }] },
            { features: [connection(), reconnection()] },
        );
        model.run("node.set-flags", { nodeId: "a", focusable: false });
        expect(model.get("node-by", { id: "a" })?.focusable).toBe(false);
        const wanted = model.get("flow-json");
        const commands = model.get("commands-to", {
            nodes: wanted.nodes.map((node) =>
                node.id === "a" ? { ...node, focusable: true } : node,
            ),
            edges: wanted.edges.map((edge) => ({
                ...edge,
                reconnectable: "source" as const,
                focusable: false,
            })),
        });
        expect(commands).toEqual([
            {
                command: "node.set-flags",
                payload: { nodeId: "a", focusable: true },
            },
            {
                command: "edge.set-flags",
                payload: {
                    edgeId: "e",
                    focusable: false,
                    reconnectable: "source",
                },
            },
        ]);
    });

    it("commands-to replaces an edge whose end may not move", () => {
        const model = createFlowModel(
            {
                ...nodes(),
                edges: [
                    {
                        id: "e",
                        source: "a",
                        target: "b",
                        reconnectable: "source",
                    },
                ],
            },
            { features: [connection(), reconnection()] },
        );
        const commands = model.get("commands-to", {
            edges: [
                {
                    id: "e",
                    source: "a",
                    target: "c",
                    reconnectable: "source",
                },
            ],
        });
        expect(commands.map((command) => command.command)).toEqual([
            "edge.remove",
            "edge.add",
        ]);
        const moved = model.get("commands-to", {
            edges: [
                {
                    id: "e",
                    source: "c",
                    target: "b",
                    reconnectable: "source",
                },
            ],
        });
        expect(moved.map((command) => command.command)).toEqual([
            "edge.reconnect",
        ]);
    });
});
