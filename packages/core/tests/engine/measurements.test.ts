// @vitest-environment jsdom
// Measurement (D8, D9): nodes with the root window's ResizeObserver, their absolute boxes (with
// sub-flows), and handles' centres relative to their nodes, whatever the zoom.
import { afterEach, describe, expect, it } from "vitest";
import { subflows } from "../../src/subflows/subflows";
import { FakeResizeObserver, flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

describe("measurement", () => {
    it("observes nodes with the ResizeObserver of the root's window", () => {
        const { engine, node, sizes, observer } = mount(
            flowOf({ a: [10, 20] }),
            {
                sizes: { a: [100, 50] },
            },
        );
        expect(FakeResizeObserver.instances).toHaveLength(1);
        expect(observer()?.observed.has(node("a"))).toBe(true);
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 10,
            y: 20,
            width: 100,
            height: 50,
        });
        expect(engine.is("node-measured", { nodeId: "a" })).toBe(true);
        const changes: unknown[] = [];
        engine.adapter.subscribe((change) => changes.push(change));
        sizes.set("a", [120, 60]);
        observer()?.trigger([node("a")]);
        expect(engine.get("node-rect-by", { nodeId: "a" })).toMatchObject({
            width: 120,
            height: 60,
        });
        expect(changes).toEqual([
            { viewport: false, measured: true, gesture: false },
        ]);
        // the same size again tells nothing
        observer()?.trigger([node("a")]);
        expect(changes).toHaveLength(1);
    });

    it("forgets a node's size when its element goes", () => {
        const { engine, node, observer } = mount(flowOf({ a: [0, 0] }), {
            sizes: { a: [100, 50] },
        });
        const element = node("a");
        engine.adapter.registerNode("a", null);
        expect(observer()?.observed.has(element)).toBe(false);
        expect(engine.is("node-measured", { nodeId: "a" })).toBe(false);
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 0,
            y: 0,
            width: 0,
            height: 0,
        });
    });

    it("takes the document's size where it gives one", () => {
        const json = flowOf({ a: [0, 0] });
        json.nodes[0] = {
            ...json.nodes[0],
            width: 80,
            height: 40,
        } as (typeof json.nodes)[0];
        const { engine } = mount(json, { sizes: { a: [100, 50] } });
        expect(engine.get("node-rect-by", { nodeId: "a" })).toEqual({
            x: 0,
            y: 0,
            width: 80,
            height: 40,
        });
    });

    it("gives a child's box in absolute flow coordinates", () => {
        const json = flowOf({ parent: [100, 100], child: [10, 20] });
        json.nodes[1] = {
            ...json.nodes[1],
            parentId: "parent",
        } as (typeof json.nodes)[1];
        const { engine } = mount(json, {
            features: [subflows()],
            sizes: { parent: [300, 200], child: [50, 50] },
        });
        expect(engine.get("node-rect-by", { nodeId: "child" })).toEqual({
            x: 110,
            y: 120,
            width: 50,
            height: 50,
        });
    });

    it("measures handles' centres relative to their node, whatever the zoom", () => {
        const { engine, node, observer } = mount(flowOf({ a: [10, 10] }), {
            sizes: { a: [100, 50] },
            engine: { defaultViewport: { x: 30, y: 40, zoom: 2 } },
            handles: [
                {
                    nodeId: "a",
                    handleId: "out",
                    type: "source",
                    side: "right",
                    x: 95,
                    y: 20,
                },
                {
                    nodeId: "a",
                    type: "target",
                    side: "left",
                    x: -5,
                    y: 20,
                    connectable: false,
                },
            ],
        });
        expect(engine.get("handles-by", { nodeId: "a" })).toEqual([
            {
                nodeId: "a",
                handleId: "out",
                type: "source",
                side: "right",
                connectable: true,
                bounds: { x: 95, y: 20, width: 10, height: 10 },
                center: { x: 110, y: 35 },
            },
            {
                nodeId: "a",
                handleId: undefined,
                type: "target",
                side: "left",
                connectable: false,
                bounds: { x: -5, y: 20, width: 10, height: 10 },
                center: { x: 10, y: 35 },
            },
        ]);
        engine.run("set-viewport", { zoom: 1 });
        observer()?.trigger([node("a")]);
        expect(engine.get("handles-by", { nodeId: "a" })[0]?.bounds).toEqual({
            x: 95,
            y: 20,
            width: 10,
            height: 10,
        });
        engine.adapter.registerHandle(
            { nodeId: "a", handleId: "out", type: "source", side: "right" },
            null,
        );
        expect(engine.get("handles-by", { nodeId: "a" })).toHaveLength(1);
    });

    it("lists the nodes in view, and those not measured yet", () => {
        const { engine } = mount(
            flowOf({ a: [0, 0], far: [5000, 5000], fresh: [9000, 9000] }),
            {
                sizes: { a: [100, 50], far: [100, 50] },
            },
        );
        expect(engine.get("visible-nodes").map((node) => node.id)).toEqual([
            "a",
            "fresh",
        ]);
        engine.run("center-on", { x: 5050, y: 5025 });
        expect(engine.get("visible-nodes").map((node) => node.id)).toEqual([
            "far",
            "fresh",
        ]);
    });
});
