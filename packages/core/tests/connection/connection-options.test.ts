// @vitest-environment jsdom
// The connection options and handle roles of #32: `connection({ threshold, lineType })`, a handle's
// `connectableStart` / `connectableEnd`, where a cancelled connection or reconnection ended (`from`,
// `to`, the client and flow drop points: what a "drop on the pane makes a node" app needs), and an
// edge's `reconnectable: "source" | "target"`.
import { afterEach, describe, expect, it } from "vitest";
import { connection } from "../../src/connection/connection";
import { bezierPath } from "../../src/geometry/bezier-path";
import { straightPath } from "../../src/geometry/straight-path";
import { createFlowModel } from "../../src/model/create-flow-model";
import { reconnection } from "../../src/reconnection/reconnection";
import type { HandleSpec } from "../engine/harness";
import { flowOf, key, mount, pointer, unmountAll } from "../engine/harness";

afterEach(unmountAll);

const at = (clientX: number, clientY: number) => ({ clientX, clientY });
const sizes = { a: [100, 50], b: [100, 50], c: [100, 50] } as Record<
    string,
    [number, number]
>;
const handles = (extra: Partial<HandleSpec> = {}): HandleSpec[] => [
    {
        nodeId: "a",
        handleId: "out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    {
        nodeId: "b",
        handleId: "in",
        type: "target",
        side: "left",
        x: -5,
        y: 20,
        ...extra,
    },
    { nodeId: "c", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
];
const json = () => flowOf({ a: [0, 0], b: [300, 0], c: [300, 200] });

describe("connection({ threshold })", () => {
    it("draws only once the press moved the threshold", () => {
        const flow = mount(json(), {
            features: [connection({ threshold: 10 })],
            sizes,
            handles: handles(),
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(109, 25));
        expect(flow.engine.is("connecting")).toBe(false);
        pointer(flow.root, "pointermove", at(110, 25));
        expect(flow.engine.is("connecting")).toBe(true);
    });

    it("starts after 1 px by default", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles: handles(),
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(101, 25));
        expect(flow.engine.is("connecting")).toBe(true);
    });
});

describe("connection({ lineType })", () => {
    it("draws the line as that edge type (bezier by default)", () => {
        const line = (lineType?: "straight") => {
            const flow = mount(json(), {
                features: [connection(lineType ? { lineType } : {})],
                sizes,
                handles: handles(),
            });
            pointer(
                flow.handle("a", "source", "out"),
                "pointerdown",
                at(100, 25),
            );
            pointer(flow.root, "pointermove", at(200, 125));
            const path = flow.engine.get("connection")?.path;
            unmountAll();
            return path;
        };
        const ends = {
            source: { x: 100, y: 25 },
            sourceSide: "right" as const,
            target: { x: 200, y: 125 },
            targetSide: "left" as const,
        };
        expect(line()).toBe(bezierPath(ends).path);
        expect(line("straight")).toBe(straightPath(ends).path);
    });
});

describe("connectableStart and connectableEnd", () => {
    it("a handle that cannot end is never a target", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles: handles({ connectableEnd: false }),
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(295, 25));
        expect(flow.engine.get("connection")?.to).toBeUndefined();
        pointer(flow.root, "pointerup", at(295, 25));
        expect(flow.model.get("all-edges")).toEqual([]);
        expect(
            flow.engine.adapter.attributes("handle", {
                nodeId: "b",
                handleId: "in",
                type: "target",
                side: "left",
                connectableEnd: false,
            }),
        ).toMatchObject({
            "data-connectable": "",
            "data-connectable-start": "",
            "data-connectable-end": undefined,
        });
    });

    it("a handle that cannot start starts nothing, and is still a target", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles: [
                {
                    nodeId: "a",
                    handleId: "out",
                    type: "source",
                    side: "right",
                    x: 95,
                    y: 20,
                    connectableStart: false,
                },
                {
                    nodeId: "b",
                    handleId: "in",
                    type: "target",
                    side: "left",
                    x: -5,
                    y: 20,
                },
            ],
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(200, 25));
        expect(flow.engine.is("connecting")).toBe(false);
        pointer(flow.root, "pointerup", at(200, 25));
        // from the target end, the start-only-not handle is a fine target
        pointer(flow.handle("b", "target", "in"), "pointerdown", at(300, 25));
        pointer(flow.root, "pointermove", at(101, 25));
        pointer(flow.root, "pointerup", at(101, 25));
        expect(flow.model.get("all-edges")).toMatchObject([
            { source: "a", target: "b" },
        ]);
    });
});

describe("a connection's cancel tells where it ended", () => {
    it("dropped on the pane: from, no to, the client and flow points", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles: handles(),
            engine: { defaultViewport: { x: 0, y: 0, zoom: 2 } },
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(200, 50));
        pointer(flow.root, "pointermove", at(400, 500));
        pointer(flow.root, "pointerup", at(400, 500));
        expect(flow.events.at(-1)).toEqual({
            type: "connect-cancel",
            refused: false,
            input: "pointer",
            from: { nodeId: "a", handleId: "out", type: "source" },
            to: undefined,
            client: { x: 400, y: 500 },
            point: { x: 200, y: 250 },
        });
    });

    it("cancelled by Escape: where the pointer was last", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles: handles(),
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(150, 300));
        key(flow.root, "Escape");
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            client: { x: 150, y: 300 },
            point: { x: 150, y: 300 },
        });
    });
});

describe("reconnectable: source | target", () => {
    const flow = (reconnectable: boolean | "source" | "target") =>
        mount(
            flowOf(
                { a: [0, 0], b: [300, 0], c: [300, 200] },
                {
                    edges: [
                        {
                            id: "e",
                            source: "a",
                            sourceHandle: "out",
                            target: "b",
                            targetHandle: "in",
                            reconnectable,
                        },
                    ],
                },
            ),
            {
                features: [connection(), reconnection()],
                sizes,
                handles: [
                    ...handles(),
                    {
                        nodeId: "c",
                        handleId: "out",
                        type: "source",
                        side: "right",
                        x: 95,
                        y: 20,
                    },
                ],
            },
        );

    it("moves only the end it names", () => {
        const source = flow("source");
        expect(source.model.is("edge-reconnectable", { edgeId: "e" })).toBe(
            true,
        );
        expect(
            source.model.is("edge-reconnectable", {
                edgeId: "e",
                end: "target",
            }),
        ).toBe(false);
        // a press near the target end takes nothing
        pointer(source.edge("e"), "pointerdown", at(293, 25));
        pointer(source.root, "pointermove", at(298, 222));
        expect(source.engine.is("edge-reconnecting", { edgeId: "e" })).toBe(
            false,
        );
        pointer(source.root, "pointerup", at(298, 222));
        // near the source end it moves it
        pointer(source.edge("e"), "pointerdown", at(103, 25));
        pointer(source.root, "pointermove", at(400, 225));
        pointer(source.root, "pointerup", at(400, 225));
        expect(source.model.get("edge-by", { id: "e" })).toMatchObject({
            source: "c",
            target: "b",
        });
    });

    it("tells a reconnect-cancel with the end it moved and its drop", () => {
        const target = flow("target");
        pointer(target.edge("e"), "pointerdown", at(293, 25));
        pointer(target.root, "pointermove", at(500, 500));
        pointer(target.root, "pointerup", at(500, 500));
        expect(target.events.at(-1)).toEqual({
            type: "reconnect-cancel",
            edgeId: "e",
            end: "target",
            refused: false,
            from: { nodeId: "a", handleId: "out", type: "source" },
            to: undefined,
            client: { x: 500, y: 500 },
            point: { x: 500, y: 500 },
        });
    });

    it("is kept by edge.reconnect and set by edge.set-flags", () => {
        const model = createFlowModel(
            flowOf(
                { a: [0, 0], b: [300, 0], c: [300, 200] },
                {
                    edges: [
                        {
                            id: "e",
                            source: "a",
                            target: "b",
                            reconnectable: "target",
                        },
                    ],
                },
            ),
            { features: [connection(), reconnection()] },
        );
        expect(
            model.run("edge.reconnect", {
                edgeId: "e",
                source: "c",
                target: "b",
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/source" },
        });
        expect(
            model.run("edge.reconnect", {
                edgeId: "e",
                source: "a",
                target: "c",
            }).ok,
        ).toBe(true);
        expect(
            model.run("edge.set-flags", {
                edgeId: "e",
                reconnectable: "source",
            }).ok,
        ).toBe(true);
        expect(model.get("edge-by", { id: "e" })?.reconnectable).toBe("source");
        expect(
            model.check("edge.set-flags", {
                edgeId: "e",
                reconnectable: "both" as never,
            }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
    });

    it("set-interactive reconnect: false stops it", () => {
        const both = flow(true);
        both.engine.run("set-interactive", { reconnect: false });
        pointer(both.edge("e"), "pointerdown", at(293, 25));
        pointer(both.root, "pointermove", at(298, 222));
        expect(both.engine.is("edge-reconnecting", { edgeId: "e" })).toBe(
            false,
        );
    });
});
