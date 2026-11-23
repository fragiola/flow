import { describe, expect, it } from "vitest";
import {
    distanceToSegment,
    segmentDistance,
    segmentHitsBox,
    wiped,
} from "../src/examples/whiteboard/eraser";
import {
    boxInPolygon,
    insideLasso,
    pointInPolygon,
} from "../src/examples/whiteboard/lasso";
import {
    addPoint,
    boundsOf,
    pathOf,
    smooth,
    strokeOf,
} from "../src/examples/whiteboard/stroke";

// The whiteboard example's geometry: a freehand stroke smoothed and saved with its own bounds, the
// lasso's hit test, and the eraser's runs against boxes and lines.

const square = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
];

describe("addPoint", () => {
    it("adds a point far enough from the last one, and skips one too near", () => {
        const one = addPoint([], { x: 0, y: 0 });
        expect(one).toEqual([{ x: 0, y: 0 }]);
        expect(addPoint(one, { x: 1, y: 1 }, 2)).toEqual(one);
        expect(addPoint(one, { x: 3, y: 0 }, 2)).toEqual([
            { x: 0, y: 0 },
            { x: 3, y: 0 },
        ]);
    });
});

describe("smooth", () => {
    it("keeps two points or fewer as they are", () => {
        const line = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ];
        expect(smooth(line)).toEqual(line);
        expect(smooth([])).toEqual([]);
    });

    it("cuts each corner at a quarter of its sides, the ends kept", () => {
        const corner = [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ];
        expect(smooth(corner, 1)).toEqual([
            { x: 0, y: 0 },
            { x: 25, y: 0 },
            { x: 75, y: 0 },
            { x: 100, y: 25 },
            { x: 100, y: 75 },
            { x: 100, y: 100 },
        ]);
        const twice = smooth(corner, 2);
        expect(twice[0]).toEqual({ x: 0, y: 0 });
        expect(twice.at(-1)).toEqual({ x: 100, y: 100 });
        // the sharp corner is gone
        expect(twice).not.toContainEqual({ x: 100, y: 0 });
    });
});

describe("boundsOf", () => {
    it("is the box around the points, none without one", () => {
        expect(boundsOf([])).toBeUndefined();
        expect(
            boundsOf([
                { x: 10, y: 40 },
                { x: -5, y: 20 },
                { x: 30, y: 25 },
            ]),
        ).toEqual({ x: -5, y: 20, width: 35, height: 20 });
    });
});

describe("pathOf", () => {
    it("runs through the points, relative to an origin, rounded to a tenth", () => {
        expect(pathOf([])).toBe("");
        expect(
            pathOf(
                [
                    { x: 10, y: 10 },
                    { x: 20.04, y: 15.26 },
                ],
                { x: 10, y: 10 },
            ),
        ).toBe("M0,0 L10,5.3");
    });
});

describe("strokeOf", () => {
    it("needs two points", () => {
        expect(strokeOf([])).toBeUndefined();
        expect(strokeOf([{ x: 1, y: 1 }])).toBeUndefined();
    });

    it("places the node at the stroke's top-left corner less the margin, its path relative to it", () => {
        const stroke = strokeOf(
            [
                { x: 100, y: 50 },
                { x: 200, y: 50 },
            ],
            4,
        );
        expect(stroke).toEqual({
            position: { x: 96, y: 46 },
            width: 108,
            height: 8,
            d: "M4,4 L104,4",
        });
    });

    it("keeps every point of the smoothed path inside the node's box", () => {
        const stroke = strokeOf(
            [
                { x: 300, y: 300 },
                { x: 340, y: 260 },
                { x: 380, y: 320 },
                { x: 420, y: 280 },
            ],
            4,
        );
        expect(stroke).toBeDefined();
        if (!stroke) return;
        expect(stroke.position.x).toBe(296);
        const coordinates = [...stroke.d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)];
        expect(coordinates.length).toBeGreaterThan(4);
        for (const [, x, y] of coordinates) {
            expect(Number(x)).toBeGreaterThanOrEqual(4);
            expect(Number(x)).toBeLessThanOrEqual(stroke.width - 4);
            expect(Number(y)).toBeGreaterThanOrEqual(4);
            expect(Number(y)).toBeLessThanOrEqual(stroke.height - 4);
        }
    });
});

describe("pointInPolygon", () => {
    it("tells inside from outside, a concave shape included", () => {
        expect(pointInPolygon({ x: 50, y: 50 }, square)).toBe(true);
        expect(pointInPolygon({ x: 150, y: 50 }, square)).toBe(false);
        // a U: its notch is outside
        const u = [
            { x: 0, y: 0 },
            { x: 30, y: 0 },
            { x: 30, y: 70 },
            { x: 70, y: 70 },
            { x: 70, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ];
        expect(pointInPolygon({ x: 50, y: 30 }, u)).toBe(false);
        expect(pointInPolygon({ x: 15, y: 30 }, u)).toBe(true);
        expect(pointInPolygon({ x: 50, y: 85 }, u)).toBe(true);
    });
});

describe("boxInPolygon and insideLasso", () => {
    it("takes a box only when all its corners are inside", () => {
        expect(
            boxInPolygon({ x: 10, y: 10, width: 20, height: 20 }, square),
        ).toBe(true);
        expect(
            boxInPolygon({ x: 90, y: 10, width: 20, height: 20 }, square),
        ).toBe(false);
    });

    it("selects nothing with fewer than three points", () => {
        expect(
            boxInPolygon({ x: 10, y: 10, width: 1, height: 1 }, [
                { x: 0, y: 0 },
                { x: 100, y: 100 },
            ]),
        ).toBe(false);
    });

    it("returns the ids of the boxes wholly inside, in order", () => {
        expect(
            insideLasso(
                [
                    { id: "a", box: { x: 10, y: 10, width: 20, height: 20 } },
                    { id: "b", box: { x: 80, y: 80, width: 40, height: 10 } },
                    { id: "c", box: { x: 60, y: 60, width: 10, height: 10 } },
                ],
                square,
            ),
        ).toEqual(["a", "c"]);
    });
});

describe("distanceToSegment and segmentDistance", () => {
    const line = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 } };

    it("measures to the nearest point of a segment, its ends included", () => {
        expect(distanceToSegment({ x: 50, y: 10 }, line)).toBe(10);
        expect(distanceToSegment({ x: -30, y: 40 }, line)).toBe(50);
        expect(
            distanceToSegment(
                { x: 3, y: 4 },
                { a: { x: 0, y: 0 }, b: { x: 0, y: 0 } },
            ),
        ).toBe(5);
    });

    it("is 0 for crossing segments, the gap otherwise", () => {
        expect(
            segmentDistance(line, {
                a: { x: 50, y: -10 },
                b: { x: 50, y: 10 },
            }),
        ).toBe(0);
        expect(
            segmentDistance(line, {
                a: { x: 50, y: 5 },
                b: { x: 60, y: 20 },
            }),
        ).toBe(5);
    });
});

describe("segmentHitsBox", () => {
    const box = { x: 0, y: 0, width: 100, height: 50 };

    it("hits with an end inside, or passing across", () => {
        expect(
            segmentHitsBox({ a: { x: 50, y: 25 }, b: { x: 50, y: 25 } }, box),
        ).toBe(true);
        expect(
            segmentHitsBox({ a: { x: -20, y: 25 }, b: { x: 200, y: 25 } }, box),
        ).toBe(true);
    });

    it("misses outside its reach, hits within it", () => {
        const by = { a: { x: -20, y: 55 }, b: { x: 200, y: 55 } };
        expect(segmentHitsBox(by, box, 0)).toBe(false);
        expect(segmentHitsBox(by, box, 6)).toBe(true);
    });
});

describe("wiped", () => {
    it("lists the boxes and lines one run of the eraser passes over", () => {
        const hit = wiped(
            { a: { x: 50, y: -50 }, b: { x: 50, y: 150 } },
            {
                nodes: [
                    { id: "on", box: { x: 0, y: 0, width: 100, height: 40 } },
                    {
                        id: "off",
                        box: { x: 200, y: 0, width: 100, height: 40 },
                    },
                ],
                edges: [
                    {
                        id: "across",
                        line: { a: { x: 0, y: 100 }, b: { x: 100, y: 100 } },
                    },
                    {
                        id: "away",
                        line: { a: { x: 200, y: 100 }, b: { x: 300, y: 100 } },
                    },
                ],
            },
            6,
        );
        expect(hit).toEqual({ nodeIds: ["on"], edgeIds: ["across"] });
    });
});
