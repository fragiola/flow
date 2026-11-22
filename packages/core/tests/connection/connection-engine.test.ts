// @vitest-environment jsdom
// The connection feature's engine side (D7): a drag from a handle draws the connection line, snaps
// to the nearest eligible handle within the radius, valid when `model.can("edge.add", …)`; a
// middleware's veto marks the handle invalid and refuses the drop.
import { afterEach, describe, expect, it } from "vitest";
import { veto } from "../../src/commands/veto";
import { connection } from "../../src/connection/connection";
import type { HandleSpec } from "../engine/harness";
import { flowOf, key, mount, pointer, unmountAll } from "../engine/harness";

afterEach(unmountAll);

const handles: HandleSpec[] = [
    {
        nodeId: "a",
        handleId: "out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    { nodeId: "b", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
    {
        nodeId: "b",
        handleId: "b-out",
        type: "source",
        side: "right",
        x: 95,
        y: 20,
    },
    { nodeId: "c", handleId: "in", type: "target", side: "left", x: -5, y: 20 },
];
const sizes = { a: [100, 50], b: [100, 50], c: [100, 50] } as Record<
    string,
    [number, number]
>;
const json = () => flowOf({ a: [0, 0], b: [300, 0], c: [300, 200] });

const at = (clientX: number, clientY: number) => ({ clientX, clientY });

describe("drawing a connection", () => {
    it("draws the line from the handle, snaps within the radius, and adds the edge on drop", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles,
        });
        const { engine, root, model, events } = flow;
        const out = flow.handle("a", "source", "out");
        pointer(out, "pointerdown", at(100, 25));
        expect(root.setPointerCapture).toHaveBeenCalledWith(1);
        expect(engine.get("connection")).toBeNull();
        pointer(root, "pointermove", at(150, 41));
        expect(engine.get("connection")).toMatchObject({
            from: {
                nodeId: "a",
                handleId: "out",
                type: "source",
                side: "right",
            },
            fromPoint: { x: 100, y: 25 },
            toPoint: { x: 150, y: 41 },
            toSide: "left",
            to: undefined,
            status: null,
            path: "M100,25 C125,25 125,41 150,41",
            reconnecting: undefined,
        });
        expect(engine.is("connecting")).toBe(true);
        expect(engine.adapter.attributes("root")["data-connecting"]).toBe("");
        expect(
            engine.adapter.attributes("handle", {
                nodeId: "a",
                handleId: "out",
                type: "source",
                side: "right",
            }),
        ).toMatchObject({
            "data-flow-part": "handle",
            "data-flow-id": "out",
            "data-handle-type": "source",
            "data-side": "right",
            "data-connectable": "",
            "data-connecting": "",
        });
        pointer(root, "pointermove", at(290, 30));
        expect(engine.get("connection")).toMatchObject({
            to: { nodeId: "b", handleId: "in" },
            toPoint: { x: 300, y: 25 },
            toSide: "left",
            status: "valid",
        });
        const inAttributes = engine.adapter.attributes("handle", {
            nodeId: "b",
            handleId: "in",
            type: "target",
            side: "left",
        });
        expect(inAttributes["data-valid"]).toBe("");
        expect(inAttributes["data-invalid"]).toBeUndefined();
        expect(engine.adapter.attributes("connection-line")["data-valid"]).toBe(
            "",
        );
        pointer(root, "pointerup", at(290, 30));
        expect(engine.get("connection")).toBeNull();
        expect(model.get("all-edges")).toEqual([
            {
                id: "edge-1",
                source: "a",
                sourceHandle: "out",
                target: "b",
                targetHandle: "in",
            },
        ]);
        expect(events).toEqual([
            {
                type: "connect-start",
                nodeId: "a",
                handleId: "out",
                handleType: "source",
                input: "pointer",
            },
            {
                type: "connect",
                edgeId: "edge-1",
                source: "a",
                target: "b",
                input: "pointer",
            },
        ]);
    });

    it("skips handles of the same type in strict mode, not in loose mode", () => {
        const strict = mount(json(), {
            features: [connection()],
            sizes,
            handles,
        });
        pointer(
            strict.handle("a", "source", "out"),
            "pointerdown",
            at(100, 25),
        );
        pointer(strict.root, "pointermove", at(398, 25));
        expect(strict.engine.get("connection")?.to).toBeUndefined();
        unmountAll();
        const loose = mount(json(), {
            features: [connection({ mode: "loose" })],
            sizes,
            handles,
        });
        pointer(loose.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(loose.root, "pointermove", at(398, 25));
        expect(loose.engine.get("connection")?.to).toMatchObject({
            handleId: "b-out",
        });
        pointer(loose.root, "pointerup", at(398, 25));
        expect(loose.model.get("all-edges")[0]).toMatchObject({
            source: "a",
            sourceHandle: "out",
            target: "b",
            targetHandle: "b-out",
        });
    });

    it("marks a handle a middleware refuses invalid, and refuses the drop", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles,
        });
        flow.model.use((ctx, next) =>
            ctx.command === "edge.add" && ctx.payload.target === "b"
                ? veto("not b")
                : next(),
        );
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(295, 25));
        expect(flow.engine.get("connection")?.status).toBe("invalid");
        expect(
            flow.engine.adapter.attributes("handle", {
                nodeId: "b",
                handleId: "in",
                type: "target",
                side: "left",
            })["data-invalid"],
        ).toBe("");
        expect(
            flow.engine.adapter.attributes("connection-line")["data-invalid"],
        ).toBe("");
        pointer(flow.root, "pointerup", at(295, 25));
        expect(flow.model.get("all-edges")).toEqual([]);
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: true,
            input: "pointer",
        });
        // c is still fine
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(305, 228));
        expect(flow.engine.get("connection")?.status).toBe("valid");
    });

    it("snaps within the radius in pixels, whatever the zoom", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles,
            engine: { defaultViewport: { x: 0, y: 0, zoom: 2 } },
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(200, 50));
        // 30 pixels from b's handle at zoom 2: out of the 20 pixels' radius
        pointer(flow.root, "pointermove", at(570, 50));
        expect(flow.engine.get("connection")?.to).toBeUndefined();
        pointer(flow.root, "pointermove", at(585, 50));
        expect(flow.engine.get("connection")?.to).toMatchObject({
            handleId: "in",
        });
    });

    it("connects from a target handle to a source handle", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles,
        });
        pointer(flow.handle("b", "target", "in"), "pointerdown", at(300, 25));
        pointer(flow.root, "pointermove", at(110, 25));
        pointer(flow.root, "pointerup", at(110, 25));
        expect(flow.model.get("all-edges")[0]).toMatchObject({
            source: "a",
            sourceHandle: "out",
            target: "b",
            targetHandle: "in",
        });
    });

    it("ends with nothing when cancelled or dropped nowhere", () => {
        const flow = mount(json(), {
            features: [connection()],
            sizes,
            handles,
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(295, 25));
        key(flow.root, "Escape");
        expect(flow.engine.get("connection")).toBeNull();
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "pointer",
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(200, 300));
        pointer(flow.root, "pointerup", at(200, 300));
        expect(flow.events.at(-1)).toMatchObject({
            type: "connect-cancel",
            refused: false,
            input: "pointer",
        });
        expect(flow.model.get("all-edges")).toEqual([]);
        expect(flow.commits).toEqual([]);
    });

    it("starts nowhere from a handle or node that is not connectable", () => {
        const flowJson = json();
        flowJson.nodes[0] = {
            ...flowJson.nodes[0],
            connectable: false,
        } as (typeof flowJson.nodes)[0];
        const flow = mount(flowJson, {
            features: [connection()],
            sizes,
            handles: [
                ...handles,
                {
                    nodeId: "c",
                    handleId: "off",
                    type: "source",
                    side: "bottom",
                    x: 45,
                    y: 45,
                    connectable: false,
                },
            ],
        });
        pointer(flow.handle("a", "source", "out"), "pointerdown", at(100, 25));
        pointer(flow.root, "pointermove", at(200, 25));
        expect(flow.engine.get("connection")).toBeNull();
        pointer(flow.root, "pointerup", at(200, 25));
        pointer(flow.handle("c", "source", "off"), "pointerdown", at(350, 250));
        pointer(flow.root, "pointermove", at(360, 300));
        expect(flow.engine.get("connection")).toBeNull();
        // nor does a press on a handle pan
        expect(flow.engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
    });
});
