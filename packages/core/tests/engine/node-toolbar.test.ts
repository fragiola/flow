import { describe, expect, it } from "vitest";
import { nodeToolbarPosition } from "../../src/engine/node-toolbar";

describe("node-toolbar-by", () => {
    const rect = { x: 100, y: 100, width: 100, height: 50 };
    const viewport = { x: 10, y: 20, zoom: 2 };

    it("places a toolbar beside a side of the node on the screen, outside the zoom", () => {
        expect(nodeToolbarPosition(rect, viewport, { nodeId: "a" })).toEqual({
            x: 310,
            y: 210,
            anchorX: 0.5,
            anchorY: 1,
        });
        expect(
            nodeToolbarPosition(rect, viewport, {
                nodeId: "a",
                side: "bottom",
                align: "start",
            }),
        ).toEqual({ x: 210, y: 330, anchorX: 0, anchorY: 0 });
        expect(
            nodeToolbarPosition(rect, viewport, {
                nodeId: "a",
                side: "right",
                align: "end",
                offset: 0,
            }),
        ).toEqual({ x: 410, y: 320, anchorX: 0, anchorY: 1 });
        expect(
            nodeToolbarPosition(rect, viewport, { nodeId: "a", side: "left" }),
        ).toEqual({
            x: 200,
            y: 270,
            anchorX: 1,
            anchorY: 0.5,
        });
    });
});
