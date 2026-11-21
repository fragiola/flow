// @vitest-environment jsdom
// The reconnection feature's engine side: a press on an edge near one of its ends drags that end
// to another handle, valid when `model.can("edge.reconnect", …)`; a veto refuses the drop.
import { afterEach, describe, expect, it } from "vitest";
import { veto } from "../../src/commands/veto";
import { connection } from "../../src/connection/connection";
import { reconnection } from "../../src/reconnection/reconnection";
import type { HandleSpec } from "../engine/harness";
import { flowOf, mount, pointer, unmountAll } from "../engine/harness";

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
const json = (reconnectable = true) =>
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
                    ...(reconnectable ? {} : { reconnectable: false }),
                },
            ],
        },
    );
const at = (clientX: number, clientY: number) => ({ clientX, clientY });
const features = () => [connection(), reconnection()] as const;

describe("reconnecting an edge", () => {
    it("drags the target end to another handle", () => {
        const flow = mount(json(), { features: features(), sizes, handles });
        pointer(flow.edge("e"), "pointerdown", at(293, 25));
        pointer(flow.root, "pointermove", at(298, 222));
        expect(flow.engine.get("connection")).toMatchObject({
            from: { nodeId: "a", handleId: "out", type: "source" },
            to: { nodeId: "c", handleId: "in" },
            status: "valid",
            reconnecting: { edgeId: "e", end: "target" },
        });
        expect(flow.engine.is("edge-reconnecting", { edgeId: "e" })).toBe(true);
        expect(
            flow.engine.adapter.attributes("edge", { edgeId: "e" })[
                "data-reconnecting"
            ],
        ).toBe("");
        pointer(flow.root, "pointerup", at(298, 222));
        expect(flow.model.get("edge-by", { id: "e" })).toEqual({
            id: "e",
            source: "a",
            sourceHandle: "out",
            target: "c",
            targetHandle: "in",
        });
        expect(flow.events).toEqual([
            { type: "reconnect-start", edgeId: "e", end: "target" },
            { type: "reconnect", edgeId: "e", source: "a", target: "c" },
        ]);
        expect(flow.engine.is("edge-reconnecting", { edgeId: "e" })).toBe(
            false,
        );
    });

    it("drags the source end, keeping the target", () => {
        const flow = mount(json(), { features: features(), sizes, handles });
        pointer(flow.edge("e"), "pointerdown", at(106, 25));
        pointer(flow.root, "pointermove", at(395, 30));
        pointer(flow.root, "pointerup", at(395, 30));
        expect(flow.model.get("edge-by", { id: "e" })).toMatchObject({
            source: "b",
            sourceHandle: "b-out",
            target: "b",
            targetHandle: "in",
        });
    });

    it("refuses a drop a middleware vetoes", () => {
        const flow = mount(json(), { features: features(), sizes, handles });
        flow.model.use((ctx, next) =>
            ctx.command === "edge.reconnect" ? veto("stays") : next(),
        );
        pointer(flow.edge("e"), "pointerdown", at(293, 25));
        pointer(flow.root, "pointermove", at(298, 222));
        expect(flow.engine.get("connection")?.status).toBe("invalid");
        pointer(flow.root, "pointerup", at(298, 222));
        expect(flow.model.get("edge-by", { id: "e" })?.target).toBe("b");
        expect(flow.events.at(-1)).toEqual({
            type: "reconnect-cancel",
            edgeId: "e",
            refused: true,
        });
    });

    it("leaves a press far from the ends and an edge that is not reconnectable", () => {
        const flow = mount(json(), { features: features(), sizes, handles });
        pointer(flow.edge("e"), "pointerdown", at(200, 25));
        pointer(flow.root, "pointermove", at(298, 222));
        expect(flow.engine.get("connection")).toBeNull();
        pointer(flow.root, "pointerup", at(298, 222));
        unmountAll();
        const fixed = mount(json(false), {
            features: features(),
            sizes,
            handles,
        });
        pointer(fixed.edge("e"), "pointerdown", at(293, 25));
        pointer(fixed.root, "pointermove", at(298, 222));
        expect(fixed.engine.get("connection")).toBeNull();
    });

    it("drags the end a reconnect anchor names, wherever it is pressed", () => {
        const flow = mount(json(), { features: features(), sizes, handles });
        const anchor = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle",
        );
        anchor.setAttribute("data-flow-part", "reconnect-anchor");
        anchor.setAttribute("data-flow-id", "e");
        anchor.setAttribute("data-end", "target");
        flow.edge("e").append(anchor);
        expect(
            flow.engine.adapter.attributes("reconnect-anchor", {
                edgeId: "e",
                end: "target",
            }),
        ).toMatchObject({ "data-flow-id": "e", "data-end": "target" });
        // far from the end: an anchor needs no radius
        pointer(anchor, "pointerdown", at(200, 25));
        pointer(flow.root, "pointermove", at(298, 222));
        expect(
            flow.engine.adapter.attributes("reconnect-anchor", {
                edgeId: "e",
                end: "target",
            })["data-reconnecting"],
        ).toBe("");
        pointer(flow.root, "pointerup", at(298, 222));
        expect(flow.model.get("edge-by", { id: "e" })?.target).toBe("c");
    });
});
