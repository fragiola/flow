import { describe, expect, it } from "vitest";
import { edgeCenter } from "../../src/geometry/edge-center";

describe("edgeCenter", () => {
    it("is the middle of the ends, with half their distance across and down", () => {
        expect(edgeCenter({ x: 10, y: 20 }, { x: 110, y: -40 })).toEqual({
            center: { x: 60, y: -10 },
            offset: { x: 50, y: 30 },
        });
        expect(edgeCenter({ x: 110, y: -40 }, { x: 10, y: 20 })).toEqual({
            center: { x: 60, y: -10 },
            offset: { x: 50, y: 30 },
        });
        expect(edgeCenter({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({
            center: { x: 5, y: 5 },
            offset: { x: 0, y: 0 },
        });
    });
});
