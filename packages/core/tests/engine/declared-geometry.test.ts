// @vitest-environment jsdom
// The geometry a document declares, used by the engine until it is measured: `initialWidth` /
// `initialHeight` (sizes, `fit-view` on init, edges), `handles` (edge ends until a handle of that
// node, type and id is measured), and `sourcePosition` / `targetPosition` (the default sides).
// `width` / `height` stay fixed sizes; `node-measured` counts the measured and fixed ones only.
import { afterEach, describe, expect, it } from "vitest";
import type { FlowJson, FlowNodeInput } from "../../src/document/types";
import { createFlowModel } from "../../src/model/create-flow-model";
import { flowOf, installFrames, mount, unmountAll } from "./harness";

afterEach(unmountAll);

const node = (
    id: string,
    x: number,
    y: number,
    extra: Partial<FlowNodeInput> = {},
): FlowJson["nodes"][number] =>
    ({
        id,
        type: "default",
        position: { x, y },
        data: {},
        ...extra,
    }) as FlowJson["nodes"][number];

describe("initialWidth and initialHeight", () => {
    const json = (): FlowJson => ({
        version: 1,
        nodes: [
            node("a", 0, 0, { initialWidth: 100, initialHeight: 100 }),
            node("b", 300, 100, { initialWidth: 100, initialHeight: 50 }),
        ],
        edges: [{ id: "ab", source: "a", target: "b" }],
    });

    it("give the size until the node is measured, then the measured one wins", async () => {
        const flow = mount(json());
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 0,
            y: 0,
            width: 100,
            height: 100,
        });
        expect(flow.engine.get("edge-path-by", { edgeId: "ab" })).toMatchObject(
            { source: { x: 50, y: 100 }, target: { x: 350, y: 100 } },
        );
        expect(flow.engine.get("drawn-edges").map((e) => e.id)).toEqual(["ab"]);
        // known, but not measured
        expect(flow.engine.is("node-measured", { nodeId: "a" })).toBe(false);
        expect(
            flow.engine.get("internal-node-by", { nodeId: "a" })?.measured,
        ).toBe(false);
        expect(
            flow.engine.adapter.attributes("node", { nodeId: "a" })[
                "data-measured"
            ],
        ).toBeUndefined();
        flow.sizes.set("a", [40, 20]);
        flow.observer()?.trigger([flow.node("a")]);
        await Promise.resolve();
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 0,
            y: 0,
            width: 40,
            height: 20,
        });
        expect(flow.engine.is("node-measured", { nodeId: "a" })).toBe(true);
        expect(flow.engine.get("edge-path-by", { edgeId: "ab" })).toMatchObject(
            { source: { x: 20, y: 20 } },
        );
    });

    it("drive fit-view on init before anything is measured, and ready comes with that fit", async () => {
        const flow = mount(json(), {
            engine: { fitView: { padding: 0 }, maxZoom: 4 },
        });
        await Promise.resolve();
        // the same framing as measured sizes of 100 × 100 and 100 × 50
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
        expect(flow.engine.is("ready")).toBe(true);
        expect(flow.engine.is("node-measured", { nodeId: "a" })).toBe(false);
    });

    it("have the fit on init redone once every node is measured at other sizes", async () => {
        const flow = mount(json(), {
            engine: { fitView: { padding: 0 }, maxZoom: 4 },
        });
        await Promise.resolve();
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
        flow.sizes.set("a", [200, 100]);
        flow.observer()?.trigger([flow.node("a")]);
        await Promise.resolve();
        // one node measured: not yet
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
        flow.sizes.set("b", [100, 100]);
        flow.observer()?.trigger([flow.node("b")]);
        await Promise.resolve();
        // the framing of 400 × 200 in 800 × 600
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 100, zoom: 2 });
        // once only
        flow.sizes.set("b", [100, 300]);
        flow.observer()?.trigger([flow.node("b")]);
        await Promise.resolve();
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 100, zoom: 2 });
    });

    it("do not have the fit redone when the view moved before the measurement", async () => {
        const flow = mount(json(), {
            engine: { fitView: { padding: 0 }, maxZoom: 4 },
        });
        await Promise.resolve();
        flow.engine.run("pan-by", { x: 10, y: 0 });
        flow.sizes.set("a", [200, 100]);
        flow.sizes.set("b", [100, 100]);
        flow.observer()?.trigger([flow.node("a"), flow.node("b")]);
        await Promise.resolve();
        expect(flow.engine.get("viewport")).toEqual({
            x: 10,
            y: 150,
            zoom: 2,
        });
    });

    it("do not have the fit redone after a set-viewport (a keyboard pan), even one undone", async () => {
        const flow = mount(json(), {
            engine: { fitView: { padding: 0 }, maxZoom: 4 },
        });
        await Promise.resolve();
        flow.engine.run("set-viewport", { x: 10 });
        flow.engine.run("set-viewport", { x: 0 });
        flow.sizes.set("a", [200, 100]);
        flow.sizes.set("b", [100, 100]);
        flow.observer()?.trigger([flow.node("a"), flow.node("b")]);
        await Promise.resolve();
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 150, zoom: 2 });
    });

    const measureAll = async (flow: ReturnType<typeof mount>) => {
        flow.sizes.set("a", [200, 100]);
        flow.sizes.set("b", [100, 100]);
        flow.observer()?.trigger([flow.node("a"), flow.node("b")]);
        await Promise.resolve();
    };

    it("have an animated fit redone when measured during its own frames", async () => {
        const frames = installFrames();
        const flow = mount(json(), {
            engine: { fitView: { padding: 0, duration: 100 }, maxZoom: 4 },
        });
        await Promise.resolve();
        frames.frame();
        await measureAll(flow);
        frames.flush();
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 100, zoom: 2 });
    });

    it("do not have an animated fit redone after a set-viewport during its frames", async () => {
        const frames = installFrames();
        const flow = mount(json(), {
            engine: { fitView: { padding: 0, duration: 100 }, maxZoom: 4 },
        });
        await Promise.resolve();
        frames.frame();
        // a keyboard pan: a move outside a gesture
        flow.engine.run("set-viewport", { x: 10 });
        await measureAll(flow);
        frames.flush();
        expect(flow.engine.get("viewport")).toMatchObject({ x: 10 });
    });

    it("never fit when fitView is off, a defaultViewport kept", async () => {
        const flow = mount(json(), {
            engine: { defaultViewport: { x: 5, y: 6, zoom: 1.5 } },
        });
        await Promise.resolve();
        expect(flow.engine.is("ready")).toBe(true);
        flow.sizes.set("a", [200, 100]);
        flow.sizes.set("b", [100, 100]);
        flow.observer()?.trigger([flow.node("a"), flow.node("b")]);
        await Promise.resolve();
        expect(flow.engine.get("viewport")).toEqual({ x: 5, y: 6, zoom: 1.5 });
    });

    it("lose to the document's width and height, per dimension", () => {
        const flow = mount({
            version: 1,
            nodes: [
                node("a", 0, 0, {
                    width: 80,
                    initialWidth: 10,
                    initialHeight: 30,
                }),
            ],
            edges: [],
        });
        expect(flow.engine.get("node-rect-by", { nodeId: "a" })).toMatchObject({
            width: 80,
            height: 30,
        });
        expect(flow.engine.is("node-measured", { nodeId: "a" })).toBe(false);
    });

    it("are validated: numbers of at least 0", () => {
        for (const initialWidth of [-1, "10"]) {
            expect(() =>
                createFlowModel({
                    version: 1,
                    nodes: [
                        node("a", 0, 0, {
                            initialWidth,
                        } as unknown as Partial<FlowNodeInput>),
                    ],
                    edges: [],
                }),
            ).toThrow();
        }
    });
});

describe("declared handles", () => {
    const json = (): FlowJson => ({
        version: 1,
        nodes: [
            node("a", 0, 0, {
                width: 100,
                height: 40,
                handles: [
                    {
                        id: "out",
                        type: "source",
                        position: "right",
                        x: 95,
                        y: 15,
                        width: 10,
                        height: 10,
                    },
                    // a point handle: its box has no size
                    { type: "source", position: "left", x: 0, y: 20 },
                ],
            }),
            node("b", 300, 0, {
                width: 100,
                height: 40,
                handles: [{ type: "target", position: "top", x: 50, y: 0 }],
            }),
        ],
        edges: [
            { id: "byId", source: "a", sourceHandle: "out", target: "b" },
            { id: "first", source: "a", target: "b" },
        ],
    });

    it("place the ends at their box's centre, by the engine's handle rule", () => {
        const { engine } = mount(json());
        expect(engine.get("edge-path-by", { edgeId: "byId" })).toMatchObject({
            source: { x: 100, y: 20 },
            sourceSide: "right",
            target: { x: 350, y: 0 },
            targetSide: "top",
        });
        // no id: the first source handle with no id
        expect(engine.get("edge-path-by", { edgeId: "first" })).toMatchObject({
            source: { x: 0, y: 20 },
            sourceSide: "left",
        });
        // they are not registered handles (a connection cannot reach them)
        expect(engine.get("handles-by", { nodeId: "a" })).toEqual([]);
    });

    it("are used only until a handle of that node, type and id is measured", () => {
        const { engine } = mount(json(), {
            handles: [
                {
                    nodeId: "a",
                    handleId: "out",
                    type: "source",
                    side: "bottom",
                    x: 45,
                    y: 35,
                },
            ],
        });
        // the measured "out" wins (10 × 10 at 45, 35: its centre 50, 40)
        expect(engine.get("edge-path-by", { edgeId: "byId" })).toMatchObject({
            source: { x: 50, y: 40 },
            sourceSide: "bottom",
        });
        // no id: the measured "out" is the first source handle (the engine's rule)
        expect(engine.get("edge-path-by", { edgeId: "first" })).toMatchObject({
            source: { x: 50, y: 40 },
        });
        // b's target is still the declared one
        expect(engine.get("edge-path-by", { edgeId: "byId" })).toMatchObject({
            target: { x: 350, y: 0 },
        });
    });

    it("are validated: a type, a side and a corner", () => {
        const bad = [
            { type: "source", position: "top", x: 0 },
            { type: "both", position: "top", x: 0, y: 0 },
            { type: "source", position: "north", x: 0, y: 0 },
            { type: "source", position: "top", x: 0, y: 0, width: -1 },
            { type: "source", position: "top", x: 0, y: 0, z: 1 },
        ];
        for (const handle of bad) {
            expect(
                () =>
                    createFlowModel({
                        version: 1,
                        nodes: [
                            node("a", 0, 0, {
                                handles: [handle],
                            } as unknown as Partial<FlowNodeInput>),
                        ],
                        edges: [],
                    }),
                JSON.stringify(handle),
            ).toThrow();
        }
    });
});

describe("sourcePosition and targetPosition", () => {
    it("set the default sides of a node's ends with no handle for them", () => {
        const { engine } = mount(
            flowOf(
                { a: [0, 0], b: [300, 0] },
                {
                    edges: [
                        { id: "ab", source: "a", target: "b" },
                        { id: "ba", source: "b", target: "a" },
                    ],
                },
            ),
            { sizes: { a: [100, 40], b: [100, 40] } },
        );
        // the defaults: a source leaves by the bottom, a target enters by the top
        expect(engine.get("edge-path-by", { edgeId: "ab" })).toMatchObject({
            source: { x: 50, y: 40 },
            sourceSide: "bottom",
            target: { x: 350, y: 0 },
            targetSide: "top",
        });
        const sided = mount(
            {
                version: 1,
                nodes: [
                    node("a", 0, 0, {
                        sourcePosition: "right",
                        targetPosition: "left",
                    }),
                    node("b", 300, 0, {
                        sourcePosition: "left",
                        targetPosition: "left",
                    }),
                ],
                edges: [
                    { id: "ab", source: "a", target: "b" },
                    { id: "ba", source: "b", target: "a" },
                ],
            },
            { sizes: { a: [100, 40], b: [100, 40] } },
        );
        expect(
            sided.engine.get("edge-path-by", { edgeId: "ab" }),
        ).toMatchObject({
            source: { x: 100, y: 20 },
            sourceSide: "right",
            target: { x: 300, y: 20 },
            targetSide: "left",
        });
        expect(
            sided.engine.get("edge-path-by", { edgeId: "ba" }),
        ).toMatchObject({
            source: { x: 300, y: 20 },
            sourceSide: "left",
            target: { x: 0, y: 20 },
            targetSide: "left",
        });
    });

    it("lose to a registered handle's side", () => {
        const { engine } = mount(
            {
                version: 1,
                nodes: [
                    node("a", 0, 0, { sourcePosition: "right" }),
                    node("b", 300, 0),
                ],
                edges: [{ id: "ab", source: "a", target: "b" }],
            },
            {
                sizes: { a: [100, 40], b: [100, 40] },
                handles: [
                    {
                        nodeId: "a",
                        type: "source",
                        side: "top",
                        x: 45,
                        y: -5,
                    },
                ],
            },
        );
        expect(engine.get("edge-path-by", { edgeId: "ab" })).toMatchObject({
            source: { x: 50, y: 0 },
            sourceSide: "top",
        });
    });
});

describe("the declared geometry in commands-to", () => {
    it("replaces a node whose declared geometry changed (no command sets it)", () => {
        const model = createFlowModel({
            version: 1,
            nodes: [node("a", 0, 0), node("b", 100, 0)],
            edges: [{ id: "ab", source: "a", target: "b" }],
        });
        const wanted = (extra: Partial<FlowNodeInput>) => ({
            nodes: [node("a", 0, 0, extra), node("b", 100, 0)],
        });
        for (const extra of [
            { initialWidth: 10 },
            { initialHeight: 10 },
            {
                handles: [
                    {
                        type: "source" as const,
                        position: "top" as const,
                        x: 0,
                        y: 0,
                    },
                ],
            },
            { sourcePosition: "right" as const },
            { targetPosition: "left" as const },
            { origin: { x: 0.5, y: 0.5 } },
        ]) {
            const steps = model.get("commands-to", wanted(extra));
            expect(
                steps.map((step) => step.command),
                JSON.stringify(extra),
            ).toEqual(["node.remove", "node.add", "edge.add"]);
        }
        expect(model.get("commands-to", wanted({}))).toEqual([]);
    });
});
