import { describe, expect, it } from "vitest";
import {
    angleFrom,
    normalizeAngle,
    rotatedSide,
} from "../src/examples/shapes/rotation";
import {
    isShape,
    SHAPE_NAMES,
    SHAPES,
    shapePath,
} from "../src/examples/shapes/shape-path";

// The shapes example's framework-free helpers: each shape's SVG path inside a node's box, and the
// rotation's maths (the angle a pointer makes around the node's centre, the side a turned handle
// faces).

/** The numbers of a path, in order. */
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe("shapePath", () => {
    it("draws every shape as a closed path inside its box, kept off its sides by the inset", () => {
        for (const shape of SHAPES) {
            const d = shapePath(shape, 140, 80, 2);
            expect(d, shape).toMatch(/^M/);
            expect(d, shape).toContain("Z");
            // every coordinate (arc radii and flags aside, all within the box too) stays inside
            for (const value of numbers(d)) {
                expect(value, `${shape}: ${d}`).toBeGreaterThanOrEqual(0);
                expect(value, `${shape}: ${d}`).toBeLessThanOrEqual(140);
            }
        }
    });

    it("gives each shape its own outline", () => {
        const paths = SHAPES.map((shape) => shapePath(shape, 140, 80));
        expect(new Set(paths).size).toBe(SHAPES.length);
    });

    it("draws the rectangle on the inset box and the diamond through its sides' middles", () => {
        expect(shapePath("rectangle", 100, 60, 1)).toBe(
            "M1 1 L99 1 L99 59 L1 59 Z",
        );
        expect(shapePath("diamond", 100, 60, 0)).toBe(
            "M50 0 L100 30 L50 60 L0 30 Z",
        );
    });

    it("bevels the hexagon and slants the parallelogram by a quarter of the width at most", () => {
        expect(shapePath("hexagon", 100, 60, 0)).toBe(
            "M25 0 L75 0 L100 30 L75 60 L25 60 L0 30 Z",
        );
        // a flat box: the slant is limited by half the height
        expect(shapePath("parallelogram", 200, 20, 0)).toBe(
            "M10 0 L200 0 L190 20 L0 20 Z",
        );
    });

    it("draws the circle as an ellipse filling the box, and the cylinder with its rim", () => {
        expect(shapePath("circle", 100, 60, 0)).toBe(
            "M0 30 A50 30 0 1 0 100 30 A50 30 0 1 0 0 30 Z",
        );
        const cylinder = shapePath("cylinder", 100, 60, 0);
        // the body, closed, then the top's front rim: two subpaths
        expect(cylinder.match(/M/g)).toHaveLength(2);
        expect(cylinder).toContain("A50 10 0 0 0 100 10");
    });

    it("rounds the corners by 12 at most, less on a small box", () => {
        expect(shapePath("rounded", 200, 100, 0)).toContain("A12 12");
        expect(shapePath("rounded", 40, 20, 0)).toContain("A5 5");
    });

    it("keeps two decimals and never draws past a box smaller than its inset", () => {
        expect(shapePath("diamond", 10, 10 / 3, 0)).toBe(
            "M5 0 L10 1.67 L5 3.33 L0 1.67 Z",
        );
        expect(shapePath("rectangle", 1, 1, 2)).toBe("M2 2 L2 2 L2 2 L2 2 Z");
    });

    it("names every shape, and knows one from anything else", () => {
        expect(Object.keys(SHAPE_NAMES)).toEqual([...SHAPES]);
        expect(isShape("diamond")).toBe(true);
        expect(isShape("star")).toBe(false);
        expect(isShape(3)).toBe(false);
    });
});

describe("normalizeAngle", () => {
    it("brings any angle into [0, 360)", () => {
        expect(normalizeAngle(0)).toBe(0);
        expect(normalizeAngle(360)).toBe(0);
        expect(normalizeAngle(-15)).toBe(345);
        expect(normalizeAngle(725)).toBe(5);
        expect(Object.is(normalizeAngle(-360), 0)).toBe(true);
    });
});

describe("angleFrom", () => {
    const center = { x: 100, y: 100 };

    it("is 0 straight up and grows clockwise (y down)", () => {
        expect(angleFrom(center, { x: 100, y: 20 })).toBe(0);
        expect(angleFrom(center, { x: 180, y: 100 })).toBe(90);
        expect(angleFrom(center, { x: 100, y: 180 })).toBe(180);
        expect(angleFrom(center, { x: 20, y: 100 })).toBe(270);
        expect(angleFrom(center, { x: 150, y: 50 })).toBe(45);
    });

    it("rounds to whole degrees, or snaps to a step", () => {
        // 30° clockwise from up
        const point = {
            x: 100 + Math.sin(Math.PI / 6) * 50,
            y: 100 - Math.cos(Math.PI / 6) * 50,
        };
        expect(angleFrom(center, point)).toBe(30);
        expect(angleFrom(center, point, 15)).toBe(30);
        expect(angleFrom(center, point, 45)).toBe(45);
        // just left of up snaps back to 0, not 360
        expect(angleFrom(center, { x: 99, y: 20 }, 15)).toBe(0);
        // a step of 0 or less is whole degrees
        expect(angleFrom(center, point, 0)).toBe(30);
    });
});

describe("rotatedSide", () => {
    it("turns a side by the nearest quarter turn, clockwise", () => {
        expect(rotatedSide("top", 0)).toBe("top");
        expect(rotatedSide("top", 44)).toBe("top");
        expect(rotatedSide("top", 46)).toBe("right");
        expect(rotatedSide("top", 90)).toBe("right");
        expect(rotatedSide("bottom", 90)).toBe("left");
        expect(rotatedSide("left", 180)).toBe("right");
        expect(rotatedSide("top", 270)).toBe("left");
        expect(rotatedSide("top", 350)).toBe("top");
        expect(rotatedSide("right", -90)).toBe("top");
    });
});
