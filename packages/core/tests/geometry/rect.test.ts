import { describe, expect, it } from "vitest";
import {
    boundsOf,
    contains,
    overlaps,
    rectFromCorners,
} from "../../src/geometry/rect";

describe("rect helpers", () => {
    it("bound rectangles", () => {
        expect(
            boundsOf([
                { x: 0, y: 10, width: 10, height: 10 },
                { x: -5, y: 0, width: 5, height: 50 },
            ]),
        ).toEqual({ x: -5, y: 0, width: 15, height: 50 });
        expect(boundsOf([])).toBeUndefined();
    });

    it("tell overlap and containment apart", () => {
        const a = { x: 0, y: 0, width: 100, height: 100 };
        expect(overlaps(a, { x: 90, y: 90, width: 20, height: 20 })).toBe(true);
        expect(contains(a, { x: 90, y: 90, width: 20, height: 20 })).toBe(
            false,
        );
        expect(contains(a, { x: 10, y: 10, width: 20, height: 20 })).toBe(true);
        expect(overlaps(a, { x: 101, y: 0, width: 5, height: 5 })).toBe(false);
    });

    it("make a rectangle from two corners in any order", () => {
        expect(rectFromCorners({ x: 10, y: 0 }, { x: 0, y: 20 })).toEqual({
            x: 0,
            y: 0,
            width: 10,
            height: 20,
        });
    });
});
