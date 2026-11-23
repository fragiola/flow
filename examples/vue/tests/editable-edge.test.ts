import { describe, expect, it } from "vitest";
import {
    distanceToSegment,
    insertPoint,
    movePoint,
    type Point,
    pathThrough,
    removePoint,
} from "../src/examples/editable-edge/control-points";
import {
    crosses,
    inflate,
    type Rect,
    type RouteEnd,
    routeAround,
    simplify,
    stepBetween,
} from "../src/examples/editable-edge/routing";

// The editable-edge example's geometry: the path through the control points, where a new point
// goes, and the orthogonal route around the nodes' boxes.

describe("pathThrough", () => {
    it("draws nothing without a point, and a line between two", () => {
        expect(pathThrough([])).toBe("");
        expect(
            pathThrough([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
            ]),
        ).toBe("M0,0 L100,0");
    });

    it("goes through every point, corners sharp without a radius", () => {
        expect(
            pathThrough([
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 50 },
            ]),
        ).toBe("M0,0 L100,0 L100,50");
    });

    it("rounds a corner by the radius, never past half a run", () => {
        expect(
            pathThrough(
                [
                    { x: 0, y: 0 },
                    { x: 100, y: 0 },
                    { x: 100, y: 50 },
                ],
                8,
            ),
        ).toBe("M0,0 L92,0 Q100,0 100,8 L100,50");
        expect(
            pathThrough(
                [
                    { x: 0, y: 0 },
                    { x: 10, y: 0 },
                    { x: 10, y: 100 },
                ],
                8,
            ),
        ).toBe("M0,0 L5,0 Q10,0 10,5 L10,100");
    });

    it("writes two decimals at most", () => {
        expect(
            pathThrough([
                { x: 0.123, y: -0.001 },
                { x: 1 / 3, y: 2 },
            ]),
        ).toBe("M0.12,0 L0.33,2");
    });
});

describe("insertPoint, movePoint, removePoint", () => {
    const source = { x: 0, y: 0 };
    const target = { x: 300, y: 0 };
    const points = [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
    ];

    it("measures the distance to a segment, clamped to its ends", () => {
        expect(distanceToSegment({ x: 50, y: 30 }, source, target)).toBe(30);
        expect(distanceToSegment({ x: -30, y: 40 }, source, target)).toBe(50);
        expect(distanceToSegment({ x: 3, y: 4 }, source, source)).toBe(5);
    });

    it("puts a new point in the run nearest to it", () => {
        // the first run: source to the first point
        expect(insertPoint(source, target, points, { x: 40, y: 50 })).toEqual([
            { x: 40, y: 50 },
            ...points,
        ]);
        // the middle run
        expect(insertPoint(source, target, points, { x: 150, y: 110 })).toEqual(
            [points[0], { x: 150, y: 110 }, points[1]],
        );
        // the last run
        expect(insertPoint(source, target, points, { x: 260, y: 40 })).toEqual([
            ...points,
            { x: 260, y: 40 },
        ]);
        // no point yet: the only run
        expect(insertPoint(source, target, [], { x: 10, y: 10 })).toEqual([
            { x: 10, y: 10 },
        ]);
    });

    it("moves and removes one point, the others kept", () => {
        expect(movePoint(points, 1, { x: 0, y: 0 })).toEqual([
            points[0],
            { x: 0, y: 0 },
        ]);
        expect(removePoint(points, 0)).toEqual([points[1]]);
        expect(points).toHaveLength(2);
    });
});

describe("simplify, stepBetween, crosses", () => {
    it("drops repeats and the middles of straight runs", () => {
        expect(
            simplify([
                { x: 0, y: 0 },
                { x: 0, y: 0 },
                { x: 50, y: 0 },
                { x: 100, y: 0 },
                { x: 100, y: 50 },
            ]),
        ).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 50 },
        ]);
    });

    it("steps across, along and across", () => {
        expect(stepBetween({ x: 0, y: 0 }, { x: 100, y: 60 })).toEqual([
            { x: 0, y: 0 },
            { x: 50, y: 0 },
            { x: 50, y: 60 },
            { x: 100, y: 60 },
        ]);
        expect(stepBetween({ x: 0, y: 10 }, { x: 100, y: 10 })).toEqual([
            { x: 0, y: 10 },
            { x: 100, y: 10 },
        ]);
    });

    it("tells a run through a box from one along or past its border", () => {
        const box = { x: 0, y: 0, width: 100, height: 100 };
        expect(crosses({ x: -10, y: 50 }, { x: 110, y: 50 }, box)).toBe(true);
        expect(crosses({ x: 50, y: -10 }, { x: 50, y: 20 }, box)).toBe(true);
        expect(crosses({ x: -10, y: 0 }, { x: 110, y: 0 }, box)).toBe(false);
        expect(crosses({ x: 100, y: -10 }, { x: 100, y: 110 }, box)).toBe(
            false,
        );
        expect(crosses({ x: 120, y: 50 }, { x: 200, y: 50 }, box)).toBe(false);
        expect(inflate(box, 10)).toEqual({
            x: -10,
            y: -10,
            width: 120,
            height: 120,
        });
    });
});

describe("routeAround", () => {
    // a source on the left, a target on the right, a tall node in the way
    const sourceNode: Rect = { x: 0, y: 120, width: 120, height: 44 };
    const wall: Rect = { x: 240, y: 40, width: 140, height: 200 };
    const targetNode: Rect = { x: 520, y: 120, width: 120, height: 44 };
    const source: RouteEnd = { point: { x: 120, y: 142 }, side: "right" };
    const target: RouteEnd = { point: { x: 520, y: 142 }, side: "left" };

    /** The whole polyline of a route: its ends and its corners. */
    const line = (points: Point[]) => [source.point, ...points, target.point];

    const runs = (points: Point[]) => {
        const all = line(points);
        return all.slice(1).map((to, i) => [all[i] as Point, to] as const);
    };

    it("goes around the node in the way, keeping the margin", () => {
        const route = routeAround(source, target, [
            sourceNode,
            wall,
            targetNode,
        ]);
        expect(route.found).toBe(true);
        expect(route.points.length).toBeGreaterThan(0);
        for (const [a, b] of runs(route.points)) {
            expect(crosses(a, b, inflate(wall, 19.9))).toBe(false);
            expect(crosses(a, b, targetNode)).toBe(false);
            expect(crosses(a, b, sourceNode)).toBe(false);
        }
    });

    it("is orthogonal, and leaves and enters square to the ends' sides", () => {
        const route = routeAround(source, target, [
            sourceNode,
            wall,
            targetNode,
        ]);
        for (const [a, b] of runs(route.points)) {
            expect(a.x === b.x || a.y === b.y).toBe(true);
        }
        const [first] = route.points;
        const last = route.points.at(-1);
        // out of the source's right side, into the target's left side
        expect(first?.y).toBe(142);
        expect(first?.x).toBeGreaterThan(120);
        expect(last?.y).toBe(142);
        expect(last?.x).toBeLessThan(520);
    });

    it("takes the straight line when nothing is in the way", () => {
        const route = routeAround(source, target, [sourceNode, targetNode]);
        expect(route).toEqual({ points: [], found: true });
    });

    it("bends as little as it can", () => {
        const route = routeAround(source, target, [
            sourceNode,
            wall,
            targetNode,
        ]);
        // out, over (or under) the wall, back down: four corners
        expect(route.points).toHaveLength(4);
    });

    it("reaches the margin past an end's own node, wherever the end sits on it", () => {
        // the ends a little inside their nodes (a handle's centre): the stubs still clear them
        const inner = routeAround(
            { point: { x: 116, y: 142 }, side: "right", node: sourceNode },
            { point: { x: 524, y: 142 }, side: "left", node: targetNode },
            [sourceNode, wall, targetNode],
        );
        expect(inner.found).toBe(true);
        // straight out to the right (a straight run's middle point dropped), straight in from the left
        expect(inner.points[0]?.y).toBe(142);
        expect(inner.points[0]?.x).toBeGreaterThanOrEqual(140);
        expect(inner.points.at(-1)?.y).toBe(142);
        expect(inner.points.at(-1)?.x).toBeLessThanOrEqual(500);
        // without the node, a stub of the margin from such an end stays inside its margin
        expect(
            routeAround({ point: { x: 116, y: 142 }, side: "right" }, target, [
                sourceNode,
                wall,
                targetNode,
            ]).found,
        ).toBe(false);
    });

    it("falls back to a plain step when the target is walled in", () => {
        const walls: Rect[] = [
            sourceNode,
            targetNode,
            { x: 440, y: 0, width: 20, height: 300 },
            { x: 440, y: 0, width: 300, height: 20 },
            { x: 440, y: 280, width: 300, height: 20 },
            { x: 720, y: 0, width: 20, height: 300 },
        ];
        const route = routeAround(source, target, walls);
        expect(route.found).toBe(false);
        // the step between the stubs: still orthogonal
        for (const [a, b] of runs(route.points)) {
            expect(a.x === b.x || a.y === b.y).toBe(true);
        }
    });

    it("falls back when an end is buried in another node", () => {
        const route = routeAround(source, target, [
            sourceNode,
            targetNode,
            { x: 100, y: 100, width: 100, height: 100 },
        ]);
        expect(route.found).toBe(false);
    });
});
