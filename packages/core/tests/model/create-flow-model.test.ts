import { describe, expect, it, vi } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import { veto } from "../../src/commands/veto";
import { FlowValidationError } from "../../src/document/flow-validation-error";
import { featuresOf } from "../../src/features/registry";
import { createFlowModel } from "../../src/model/create-flow-model";
import { selection } from "../../src/selection/selection";
import { chain, task } from "../fixture";

describe("createFlowModel", () => {
    it("loads in Node with no DOM, an empty flow without a document", () => {
        expect(typeof globalThis.document).toBe("undefined");
        const model = createFlowModel();
        expect(model.get("flow-json")).toEqual({
            version: 1,
            nodes: [],
            edges: [],
        });
    });

    it("exposes exactly the five verbs, use, subscribe and dispatch, bound", () => {
        const model = createFlowModel(chain());
        expect(Object.keys(model).sort()).toEqual(
            [
                "can",
                "check",
                "dispatch",
                "get",
                "is",
                "run",
                "subscribe",
                "use",
            ].sort(),
        );
        const { run, get } = model;
        expect(
            run("node.move", { nodeId: "a", position: { x: 5, y: 5 } }).ok,
        ).toBe(true);
        expect(get("node-by", { id: "a" })?.position).toEqual({ x: 5, y: 5 });
        expect(Object.isFrozen(model)).toBe(true);
    });

    it("throws a FlowValidationError listing every issue of an invalid document", () => {
        const invalid = { version: 1, nodes: [{ type: "x" }], edges: [] };
        expect(() => createFlowModel(invalid as never)).toThrow(
            FlowValidationError,
        );
        try {
            createFlowModel(invalid as never);
        } catch (error) {
            expect((error as FlowValidationError).issues).toEqual([
                { path: "/nodes/0/position", message: "is required" },
                { path: "/nodes/0/data", message: "is required" },
            ]);
        }
    });

    it("generates missing ids with the injected createId, and round-trips through flow-json", () => {
        const json = {
            version: 1 as const,
            nodes: [
                { type: "task", position: { x: 0, y: 0 }, data: { n: 1 } },
                task("a"),
            ],
            edges: [{ source: "a", target: "a" }],
        };
        const model = createFlowModel(json, {
            createId: (kind) => `${kind}-custom`,
        });
        const out = model.get("flow-json");
        expect(out.nodes.map((node) => node.id)).toEqual(["node-custom", "a"]);
        expect(out.edges[0]?.id).toBe("edge-custom");
        expect(createFlowModel(out).get("flow-json")).toEqual(out);
        // a writable copy: changing it changes nothing in the model
        out.nodes.pop();
        expect(model.get("all-nodes")).toHaveLength(2);
        // the given document is not frozen nor kept
        expect(Object.isFrozen(json.nodes[0])).toBe(false);
    });

    it("freezes the document, and shares every untouched node after a command", () => {
        const model = createFlowModel(chain());
        const before = model.get("all-nodes");
        expect(Object.isFrozen(before)).toBe(true);
        expect(Object.isFrozen(before[0]?.position)).toBe(true);
        model.run("node.move", { nodeId: "b", position: { x: 1, y: 1 } });
        const after = model.get("all-nodes");
        expect(after).not.toBe(before);
        expect(after[0]).toBe(before[0]);
        expect(after[1]).not.toBe(before[1]);
        expect(
            createFlowModel(chain(), { freeze: false }).get("all-nodes"),
        ).not.toSatisfy(Object.isFrozen);
    });

    it("records its features for the engine, a bare flow's for anything else", () => {
        const model = createFlowModel(chain(), { features: [selection()] });
        expect([...featuresOf(model).names]).toEqual(["selection"]);
        expect(featuresOf({}).list).toEqual([]);
    });
});

describe("the bus", () => {
    it("never throws on bad input: unknown names, malformed payloads, missing entities, refusals", () => {
        const model = createFlowModel(chain());
        const run = model.run as (
            command: string,
            payload?: unknown,
        ) => unknown;
        expect(run("node.fly", {})).toEqual({
            ok: false,
            error: {
                code: "unknown_command",
                message: 'unknown command "node.fly"',
            },
        });
        expect(
            run("node.move", { nodeId: 1, position: { x: 0, y: 0 } }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/nodeId" },
        });
        expect(run("node.move", null)).toMatchObject({
            error: { code: "invalid_payload", path: "" },
        });
        expect(run("node.remove", { nodeId: "zz" })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no node "zz"',
                path: "/nodeId",
            },
        });
        model.run("node.set-flags", { nodeId: "a", deletable: false });
        expect(run("node.remove", { nodeId: "a" })).toMatchObject({
            error: { code: "refused", path: "/nodeId" },
        });
    });

    it("answers a command of a feature that is not installed with not_found, naming the feature", () => {
        const model = createFlowModel(chain());
        const run = model.run as (
            command: string,
            payload?: unknown,
        ) => unknown;
        expect(run("selection.set", { nodeIds: ["a"] })).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message:
                    '"selection.set" requires the selection feature (`@fragiola/flow/selection`)',
            },
        });
        expect(
            model.dispatch({ command: "edge.reconnect", payload: {} }),
        ).toMatchObject({
            error: { code: "not_found", path: "/command" },
        });
        const get = model.get as (key: string) => unknown;
        expect(get("selected-nodes")).toBeUndefined();
        expect(
            (model.is as (key: string, payload: object) => boolean)(
                "node-selected",
                {
                    nodeId: "a",
                },
            ),
        ).toBe(false);
    });

    it("can and check run the rules and the middleware, and commit nothing", () => {
        const model = createFlowModel(chain());
        const listener = vi.fn();
        model.subscribe(listener);
        const seen: boolean[] = [];
        model.use((ctx, next) => {
            seen.push(ctx.dryRun);
            return next();
        });
        expect(model.can("node.add", task("x"))).toBe(true);
        expect(
            model.check("node.add", {
                type: "task",
                position: { x: 0, y: 0 },
                data: {},
            }),
        ).toEqual({ ok: true, value: { nodeId: "node-1" } });
        expect(model.check("node.add", task("a"))).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/id" },
        });
        expect(model.get("all-nodes")).toHaveLength(3);
        expect(listener).not.toHaveBeenCalled();
        expect(seen).toEqual([true, true, true]);
        // a dry run draws no id
        expect(
            model.run("node.add", {
                type: "t",
                position: { x: 0, y: 0 },
                data: {},
            }),
        ).toEqual({ ok: true, value: { nodeId: "node-1" } });
    });

    it("emits one event per commit, with the payload, result, documents and options", () => {
        const model = createFlowModel(chain());
        const events: CommandEvent[] = [];
        const stop = model.subscribe((event) => events.push(event));
        const before = model.get("all-nodes");
        model.run(
            "node.move",
            { nodeId: "a", position: { x: 9, y: 9 } },
            { transient: true, meta: { source: "test" } },
        );
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
            command: "node.move",
            payload: { nodeId: "a", position: { x: 9, y: 9 } },
            result: { nodeId: "a", position: { x: 9, y: 9 } },
            transient: true,
            meta: { source: "test" },
        });
        expect(events[0]?.before.nodes).toBe(before);
        expect(events[0]?.after.nodes).toBe(model.get("all-nodes"));
        model.run("node.remove", { nodeId: "zz" });
        expect(events).toHaveLength(1);
        stop();
        model.run("node.move", { nodeId: "a", position: { x: 1, y: 1 } });
        expect(events).toHaveLength(1);
    });

    it("refuses a transient step of a command that cannot be one", () => {
        const model = createFlowModel(chain());
        expect(
            model.run("node.remove", { nodeId: "a" }, { transient: true }),
        ).toMatchObject({
            error: { code: "invalid_payload", path: "/transient" },
        });
    });

    it("rethrows a listener's error after every listener heard the event", () => {
        const model = createFlowModel(chain());
        const second = vi.fn();
        model.subscribe(() => {
            throw new Error("boom");
        });
        model.subscribe(second);
        expect(() =>
            model.run("node.move", { nodeId: "a", position: { x: 1, y: 1 } }),
        ).toThrow("boom");
        expect(second).toHaveBeenCalledOnce();
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 1,
            y: 1,
        });
    });
});

describe("batch", () => {
    it("runs every command in one step, with one event listing them", () => {
        const model = createFlowModel(chain());
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        const result = model.run("batch", {
            commands: [
                { command: "node.add", payload: task("d", 600) },
                { command: "edge.add", payload: { source: "c", target: "d" } },
                {
                    command: "node.move",
                    payload: { nodeId: "a", position: { x: 1, y: 2 } },
                },
            ],
        });
        expect(result).toEqual({
            ok: true,
            value: {
                results: [
                    { nodeId: "d" },
                    { edgeId: "edge-1" },
                    { nodeId: "a", position: { x: 1, y: 2 } },
                ],
            },
        });
        expect(events).toHaveLength(1);
        expect(events[0]?.command).toBe("batch");
        expect(events[0]?.commands?.map((step) => step.command)).toEqual([
            "node.add",
            "edge.add",
            "node.move",
        ]);
    });

    it("is all or nothing: the first failure is its result, its path into the batch", () => {
        const model = createFlowModel(chain());
        const listener = vi.fn();
        model.subscribe(listener);
        const before = model.get("flow-json");
        expect(
            model.run("batch", {
                commands: [
                    { command: "node.add", payload: task("d") },
                    {
                        command: "edge.add",
                        payload: { source: "d", target: "zz" },
                    },
                ],
            }),
        ).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no node "zz"',
                path: "/commands/1/payload/target",
            },
        });
        const run = model.run as (command: string, payload: unknown) => unknown;
        expect(
            run("batch", { commands: [{ command: "node.fly", payload: {} }] }),
        ).toMatchObject({
            error: { code: "unknown_command", path: "/commands/0/command" },
        });
        expect(
            run("batch", {
                commands: [{ command: "selection.clear", payload: {} }],
            }),
        ).toMatchObject({
            error: { code: "not_found", path: "/commands/0/command" },
        });
        expect(model.get("flow-json")).toEqual(before);
        expect(listener).not.toHaveBeenCalled();
    });

    it("sees its earlier commands: a later one acts on what an earlier one added", () => {
        const model = createFlowModel(chain());
        expect(
            model.run("batch", {
                commands: [
                    { command: "node.add", payload: task("d") },
                    { command: "node.remove", payload: { nodeId: "d" } },
                ],
            }).ok,
        ).toBe(true);
        expect(model.get("node-by", { id: "d" })).toBeUndefined();
    });

    it("may be a transient step only when each of its commands may", () => {
        const model = createFlowModel(chain());
        expect(
            model.run(
                "batch",
                {
                    commands: [
                        {
                            command: "node.move",
                            payload: { nodeId: "a", position: { x: 1, y: 1 } },
                        },
                        {
                            command: "node.move",
                            payload: { nodeId: "b", position: { x: 2, y: 2 } },
                        },
                    ],
                },
                { transient: true },
            ).ok,
        ).toBe(true);
        expect(
            model.run(
                "batch",
                {
                    commands: [
                        { command: "node.remove", payload: { nodeId: "a" } },
                    ],
                },
                { transient: true },
            ),
        ).toMatchObject({
            error: { code: "invalid_payload", path: "/commands/0/command" },
        });
    });
});

describe("middleware", () => {
    it("vetoes: the command does not apply and returns vetoed", () => {
        const model = createFlowModel(chain());
        model.use((ctx, next) =>
            ctx.command === "edge.add" && ctx.payload.target === "a"
                ? veto("nothing goes into a")
                : next(),
        );
        expect(model.can("edge.add", { source: "c", target: "a" })).toBe(false);
        expect(model.run("edge.add", { source: "c", target: "a" })).toEqual({
            ok: false,
            error: { code: "vetoed", message: "nothing goes into a" },
        });
        expect(model.run("edge.add", { source: "a", target: "c" }).ok).toBe(
            true,
        );
    });

    it("vetoes a batch's command, failing the whole batch", () => {
        const model = createFlowModel(chain());
        model.use((ctx, next) =>
            ctx.command === "node.remove" ? veto() : next(),
        );
        const inBatch: boolean[] = [];
        model.use((ctx, next) => {
            inBatch.push(ctx.inBatch);
            return next();
        });
        expect(
            model.run("batch", {
                commands: [
                    {
                        command: "node.move",
                        payload: { nodeId: "a", position: { x: 1, y: 1 } },
                    },
                    { command: "node.remove", payload: { nodeId: "b" } },
                ],
            }),
        ).toMatchObject({ ok: false, error: { code: "vetoed" } });
        expect(inBatch).toEqual([false, true]);
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
    });

    it("rewrites a payload, which is validated again", () => {
        const model = createFlowModel(chain());
        model.use((ctx, next) => {
            if (ctx.command === "node.move") {
                ctx.payload = {
                    ...ctx.payload,
                    position: {
                        x: Math.round(ctx.payload.position.x / 10) * 10,
                        y: 0,
                    },
                };
            }
            return next();
        });
        expect(
            model.run("node.move", { nodeId: "a", position: { x: 14, y: 3 } }),
        ).toEqual({
            ok: true,
            value: { nodeId: "a", position: { x: 10, y: 0 } },
        });
        const bad = createFlowModel(chain());
        bad.use((ctx, next) => {
            if (ctx.command === "node.move") {
                ctx.payload = { nodeId: "a" } as never;
            }
            return next();
        });
        expect(
            bad.run("node.move", { nodeId: "a", position: { x: 1, y: 1 } }),
        ).toMatchObject({
            ok: false,
            error: {
                code: "invalid_payload",
                message: "rewritten by a middleware: is required",
                path: "/position",
            },
        });
    });

    it("sees dryRun, the state, and the draft through ctx.get inside a batch", () => {
        const model = createFlowModel(chain());
        const seen: unknown[] = [];
        model.use((ctx, next) => {
            if (ctx.command === "edge.add") {
                seen.push(
                    ctx.dryRun,
                    ctx.get("node-by", { id: "d" })?.id,
                    ctx.state.nodes.length,
                );
            }
            return next();
        });
        model.run("batch", {
            commands: [
                { command: "node.add", payload: task("d") },
                { command: "edge.add", payload: { source: "a", target: "d" } },
            ],
        });
        model.can("edge.add", { source: "a", target: "c" });
        // the batch committed: the dry run sees d in the committed state
        expect(seen).toEqual([false, "d", 3, true, "d", 4]);
    });

    it("observes the result, may replace it, and is removed by its remover", () => {
        const model = createFlowModel(chain());
        const results: boolean[] = [];
        const remove = model.use((_ctx, next) => {
            results.push(next().ok);
            return undefined;
        });
        model.run("node.remove", { nodeId: "zz" });
        model.run("node.remove", { nodeId: "c" });
        expect(results).toEqual([false, true]);
        remove();
        model.run("node.remove", { nodeId: "b" });
        expect(results).toHaveLength(2);
        const silent = createFlowModel(chain());
        silent.use(() => undefined);
        expect(silent.run("node.remove", { nodeId: "a" })).toMatchObject({
            error: {
                code: "vetoed",
                message: "a middleware returned no result",
            },
        });
    });

    it("turns a throwing middleware into middleware_error", () => {
        const model = createFlowModel(chain());
        model.use(() => {
            throw new Error("nope");
        });
        expect(model.run("node.remove", { nodeId: "a" })).toEqual({
            ok: false,
            error: { code: "middleware_error", message: "nope" },
        });
    });

    it("queues a command issued from a middleware: it runs after the current one", () => {
        const model = createFlowModel(chain());
        const order: string[] = [];
        let queued: unknown;
        model.use((ctx, next) => {
            if (ctx.command === "node.remove" && !ctx.dryRun) {
                queued = model.run("node.add", task("z"));
            }
            return next();
        });
        model.subscribe((event) => order.push(event.command));
        expect(model.run("node.remove", { nodeId: "c" }).ok).toBe(true);
        expect(queued).toMatchObject({ ok: false, error: { code: "queued" } });
        expect(order).toEqual(["node.remove", "node.add"]);
        expect(model.get("node-by", { id: "z" })).toBeDefined();
    });

    it("runs outermost first", () => {
        const model = createFlowModel(chain());
        const order: string[] = [];
        model.use((_ctx, next) => {
            order.push("outer in");
            const result = next();
            order.push("outer out");
            return result;
        });
        model.use((_ctx, next) => {
            order.push("inner");
            return next();
        });
        model.run("node.move", { nodeId: "a", position: { x: 1, y: 1 } });
        expect(order).toEqual(["outer in", "inner", "outer out"]);
    });
});

describe("dispatch", () => {
    it("validates the envelope first, then runs the command with its paths under /payload", () => {
        const model = createFlowModel(chain());
        expect(model.dispatch("x")).toMatchObject({
            error: { code: "invalid_payload", path: "" },
        });
        expect(model.dispatch({ payload: {} })).toMatchObject({
            error: { path: "/command" },
        });
        expect(model.dispatch({ command: "x.y", payload: {} })).toMatchObject({
            error: { code: "unknown_command", path: "/command" },
        });
        expect(model.dispatch({ command: "node.remove" })).toMatchObject({
            error: { code: "invalid_payload", path: "/payload" },
        });
        expect(
            model.dispatch({
                command: "node.remove",
                payload: { nodeId: "a" },
                transient: 1,
            }),
        ).toMatchObject({ error: { path: "/transient" } });
        expect(
            model.dispatch({
                command: "node.remove",
                payload: { nodeId: "a" },
                meta: {},
            }),
        ).toMatchObject({ error: { code: "invalid_payload", path: "/meta" } });
        expect(
            model.dispatch({
                command: "node.remove",
                payload: { nodeId: "zz" },
            }),
        ).toEqual({
            ok: false,
            error: {
                code: "not_found",
                message: 'no node "zz"',
                path: "/payload/nodeId",
            },
        });
    });

    it("hands the app's meta, never the input's, to middleware and listeners", () => {
        const model = createFlowModel(chain());
        const metas: unknown[] = [];
        model.subscribe((event) => metas.push(event.meta));
        expect(
            model.dispatch(
                {
                    command: "node.move",
                    payload: { nodeId: "a", position: { x: 3, y: 3 } },
                },
                { meta: { source: "assistant" } },
            ).ok,
        ).toBe(true);
        expect(metas).toEqual([{ source: "assistant" }]);
    });
});

describe("the bus's guarantees", () => {
    it("hands the chain a frozen copy: an in-place write is a middleware_error, the caller's object untouched", () => {
        const model = createFlowModel(chain());
        model.use((ctx, next) => {
            if (ctx.command === "node.resize") {
                (ctx.payload as { width: number }).width = -50;
            }
            return next();
        });
        const payload = { nodeId: "a", width: 10, height: 10 };
        expect(model.run("node.resize", payload)).toMatchObject({
            ok: false,
            error: { code: "middleware_error" },
        });
        expect(model.get("node-by", { id: "a" })).not.toHaveProperty("width");
        expect(payload.width).toBe(10);
        const events: CommandEvent[] = [];
        const plain = createFlowModel(chain());
        plain.subscribe((event) => events.push(event));
        const moved = { nodeId: "a", position: { x: 1, y: 1 } };
        plain.run("node.move", moved);
        expect(events[0]?.payload).toEqual(moved);
        expect(events[0]?.payload).not.toBe(moved);
        expect(Object.isFrozen(events[0]?.payload)).toBe(true);
    });

    it("never lets a middleware turn a failure into a success (a batch stays all or nothing)", () => {
        const model = createFlowModel(chain());
        model.use((ctx, next) => {
            const result = next();
            return ctx.command === "node.remove"
                ? { ok: true, value: null }
                : result;
        });
        expect(
            model.run("batch", {
                commands: [
                    {
                        command: "node.move",
                        payload: { nodeId: "a", position: { x: 9, y: 9 } },
                    },
                    { command: "node.remove", payload: { nodeId: "zz" } },
                ],
            }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(model.get("node-by", { id: "a" })?.position).toEqual({
            x: 0,
            y: 0,
        });
    });

    it("points a batch step's error without a path of its own at the step", () => {
        const model = createFlowModel(chain());
        model.use((ctx, next) =>
            ctx.command === "node.remove" ? veto("no") : next(),
        );
        expect(
            model.run("batch", {
                commands: [
                    {
                        command: "node.move",
                        payload: { nodeId: "a", position: { x: 1, y: 1 } },
                    },
                    { command: "node.remove", payload: { nodeId: "b" } },
                ],
            }),
        ).toEqual({
            ok: false,
            error: { code: "vetoed", message: "no", path: "/commands/1" },
        });
    });

    it("lists a nested batch's commands once, not the nested batch itself", () => {
        const model = createFlowModel(chain());
        const events: CommandEvent[] = [];
        model.subscribe((event) => events.push(event));
        model.run("batch", {
            commands: [
                {
                    command: "batch",
                    payload: {
                        commands: [{ command: "node.add", payload: task("d") }],
                    },
                },
                { command: "node.add", payload: task("e") },
            ],
        });
        expect(events[0]?.commands?.map((step) => step.command)).toEqual([
            "node.add",
            "node.add",
        ]);
    });

    it("refuses a command a middleware issues during a dry run", () => {
        const model = createFlowModel(chain());
        let issued: unknown;
        model.use((ctx, next) => {
            if (ctx.dryRun && ctx.command === "node.move") {
                issued = model.run("node.remove", { nodeId: "c" });
            }
            return next();
        });
        expect(
            model.can("node.move", { nodeId: "a", position: { x: 1, y: 1 } }),
        ).toBe(true);
        expect(issued).toMatchObject({ ok: false, error: { code: "refused" } });
        expect(model.get("node-by", { id: "c" })).toBeDefined();
    });

    it("never asks the app's createId in a dry run", () => {
        let asked = 0;
        const model = createFlowModel(chain(), {
            createId: (kind) => `${kind}#${++asked}`,
        });
        const add = { type: "task", position: { x: 0, y: 0 }, data: {} };
        expect(model.check("node.add", add)).toEqual({
            ok: true,
            value: { nodeId: "node-1" },
        });
        expect(model.can("edge.add", { source: "a", target: "c" })).toBe(true);
        expect(asked).toBe(0);
        expect(model.run("node.add", add)).toEqual({
            ok: true,
            value: { nodeId: "node#1" },
        });
    });
});
