// @vitest-environment jsdom
// `internal-node-by`: a node as the engine knows it on screen (what `useInternalNode` reads):
// the document's node, its absolute place and box, whether its size is known, its z-index and
// its handles.
import { afterEach, describe, expect, it } from "vitest";
import { selection } from "../../src/selection/selection";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

describe("internal-node-by", () => {
    it("assembles a measured node's box, z-index and handles", () => {
        const { engine, model } = mount(flowOf({ a: [40, 20], b: [300, 0] }), {
            features: [selection()],
            sizes: { a: [120, 60] },
            engine: { nodeOrigin: { x: 0.5, y: 0.5 } },
            handles: [
                {
                    nodeId: "a",
                    handleId: "out",
                    type: "source",
                    side: "right",
                    x: 115,
                    y: 25,
                },
            ],
        });
        model.run("selection.set", { nodeIds: ["a"] });
        const internal = engine.get("internal-node-by", { nodeId: "a" });
        expect(internal).toMatchObject({
            id: "a",
            node: model.get("node-by", { id: "a" }),
            absolutePosition: { x: 40, y: 20 },
            rect: { x: -20, y: -10, width: 120, height: 60 },
            measured: true,
            zIndex: engine.get("node-z-index-by", { nodeId: "a" }),
        });
        expect(internal?.zIndex).toBeGreaterThan(0);
        expect(internal?.handles).toEqual(
            engine.get("handles-by", { nodeId: "a" }),
        );
        expect(internal?.handles).toHaveLength(1);
    });

    it("tells a node of unknown size, and nothing of an unknown node", () => {
        const { engine } = mount(flowOf({ a: [0, 0], b: [300, 0] }), {
            sizes: { a: [100, 50] },
        });
        expect(engine.get("internal-node-by", { nodeId: "b" })).toMatchObject({
            measured: false,
            rect: { x: 300, y: 0, width: 0, height: 0 },
            handles: [],
        });
        expect(
            engine.get("internal-node-by", { nodeId: "nobody" }),
        ).toBeUndefined();
    });
});
