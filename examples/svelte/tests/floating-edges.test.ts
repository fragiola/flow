import { describe, expect, it } from "vitest";
import {
    type Box,
    borderPoint,
    centerOf,
    floatingEnds,
    nearestSide,
    sideAt,
    sideCenter,
    simpleEnds,
} from "../src/examples/floating-edges/border-intersection";

// The floating-edges example's border geometry: where the line between two nodes' centres leaves
// a box or an ellipse, the side it meets, and the "simple" ends at the nearest sides' middles.

const rect = (x: number, y: number, width: number, height: number): Box => ({
    x,
    y,
    width,
    height,
    shape: "rect",
});
const ellipse = (x: number, y: number, width: number, height: number): Box => ({
    x,
    y,
    width,
    height,
    shape: "ellipse",
});

/** How far a point is from an ellipse box's border: 1 on it (normalised radius). */
const radius = (box: Box, point: { x: number; y: number }) => {
    const c = centerOf(box);
    return Math.hypot(
        (point.x - c.x) / (box.width / 2),
        (point.y - c.y) / (box.height / 2),
    );
};

/** A point, to floating-point precision. */
const expectPoint = (
    actual: { x: number; y: number },
    expected: { x: number; y: number },
) => {
    expect(actual.x).toBeCloseTo(expected.x);
    expect(actual.y).toBeCloseTo(expected.y);
};

describe("borderPoint", () => {
    const box = rect(0, 0, 140, 56); // centre (70, 28)

    it("meets a rectangle's side the line leaves by", () => {
        expectPoint(borderPoint(box, { x: 400, y: 28 }), { x: 140, y: 28 });
        expectPoint(borderPoint(box, { x: 70, y: -300 }), { x: 70, y: 0 });
        expectPoint(borderPoint(box, { x: -50, y: 28 }), { x: 0, y: 28 });
    });

    it("meets the nearer pair of a rectangle's sides on a slanted line", () => {
        const steep = borderPoint(box, { x: 80, y: 128 });
        expect(steep.y).toBeCloseTo(56);
        expect(steep.x).toBeCloseTo(72.8);
        const shallow = borderPoint(box, { x: 170, y: 38 });
        expect(shallow.x).toBeCloseTo(140);
        expect(shallow.y).toBeCloseTo(35);
    });

    it("meets an ellipse on its curve, not its box", () => {
        const round = ellipse(0, 0, 200, 100); // centre (100, 50), radii 100 and 50
        expect(borderPoint(round, { x: 500, y: 50 })).toEqual({
            x: 200,
            y: 50,
        });
        const slanted = borderPoint(round, { x: 300, y: 250 });
        expect(radius(round, slanted)).toBeCloseTo(1);
        // inside the box's corner: a box would have been met further out
        expect(slanted.x).toBeLessThan(200);
        expect(slanted.y).toBeLessThan(100);
        expect(slanted.x - 100).toBeCloseTo(slanted.y - 50);
    });

    it("keeps the centre when the point is the centre", () => {
        expect(borderPoint(box, { x: 70, y: 28 })).toEqual({ x: 70, y: 28 });
        expect(borderPoint(ellipse(0, 0, 10, 10), { x: 5, y: 5 })).toEqual({
            x: 5,
            y: 5,
        });
    });
});

describe("sideAt", () => {
    it("reads the side from the offset against half the box", () => {
        const box = rect(0, 0, 200, 40); // centre (100, 20)
        expect(sideAt(box, { x: 200, y: 30 })).toBe("right");
        expect(sideAt(box, { x: 0, y: 10 })).toBe("left");
        expect(sideAt(box, { x: 150, y: 0 })).toBe("top");
        expect(sideAt(box, { x: 60, y: 40 })).toBe("bottom");
    });
});

describe("sideCenter and nearestSide", () => {
    const box = rect(0, 0, 100, 60);

    it("places each side's middle", () => {
        expect(sideCenter(box, "top")).toEqual({ x: 50, y: 0 });
        expect(sideCenter(box, "right")).toEqual({ x: 100, y: 30 });
        expect(sideCenter(box, "bottom")).toEqual({ x: 50, y: 60 });
        expect(sideCenter(box, "left")).toEqual({ x: 0, y: 30 });
    });

    it("picks the side whose middle is nearest", () => {
        expect(nearestSide(box, { x: 300, y: 40 })).toBe("right");
        expect(nearestSide(box, { x: 60, y: -200 })).toBe("top");
        expect(nearestSide(box, { x: -10, y: 300 })).toBe("bottom");
        expect(nearestSide(box, { x: -300, y: 20 })).toBe("left");
    });
});

describe("floatingEnds", () => {
    it("cuts the line between the centres at both borders", () => {
        const ends = floatingEnds(rect(0, 0, 100, 50), rect(300, 0, 100, 50));
        expect(ends).toEqual({
            source: { x: 100, y: 25 },
            sourceSide: "right",
            target: { x: 300, y: 25 },
            targetSide: "left",
        });
    });

    it("follows the nodes whichever way they face each other", () => {
        const ends = floatingEnds(rect(0, 300, 100, 50), rect(0, 0, 100, 50));
        expect(ends.source).toEqual({ x: 50, y: 300 });
        expect(ends.sourceSide).toBe("top");
        expect(ends.target).toEqual({ x: 50, y: 50 });
        expect(ends.targetSide).toBe("bottom");
    });

    it("meets a round node on its curve", () => {
        const hub = ellipse(0, 0, 100, 100);
        const ends = floatingEnds(hub, rect(300, 300, 80, 80));
        expect(radius(hub, ends.source)).toBeCloseTo(1);
        expect(ends.source.x).toBeCloseTo(50 + 50 * Math.SQRT1_2);
    });
});

describe("simpleEnds", () => {
    it("joins the middles of the sides nearest each other", () => {
        const ends = simpleEnds(rect(0, 0, 100, 50), rect(300, 200, 100, 50));
        expect(ends).toEqual({
            source: { x: 100, y: 25 },
            sourceSide: "right",
            target: { x: 300, y: 225 },
            targetSide: "left",
        });
    });

    it("leaves by the top or bottom when the other node is above or below", () => {
        const ends = simpleEnds(rect(0, 400, 100, 50), rect(20, 0, 100, 50));
        expect(ends.sourceSide).toBe("top");
        expect(ends.source).toEqual({ x: 50, y: 400 });
        expect(ends.targetSide).toBe("bottom");
        expect(ends.target).toEqual({ x: 70, y: 50 });
    });
});
