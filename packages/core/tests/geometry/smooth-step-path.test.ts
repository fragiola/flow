import { describe, expect, it } from "vitest";
import {
    halfwayAlong,
    orthogonalRoute,
    smoothStepPath,
    stepPath,
} from "../../src/geometry/smooth-step-path";
import type { HandleSide } from "../../src/geometry/types";

const ends = (
    source: [number, number],
    sourceSide: HandleSide,
    target: [number, number],
    targetSide: HandleSide,
) => ({
    source: { x: source[0], y: source[1] },
    sourceSide,
    target: { x: target[0], y: target[1] },
    targetSide,
});

describe("stepPath", () => {
    it("turns halfway between two facing ends with the target ahead", () => {
        expect(stepPath(ends([0, 0], "right", [100, 50], "left"))).toEqual({
            path: "M0,0 L50,0 L50,50 L100,50",
            label: { x: 50, y: 25 },
        });
    });

    it("goes out, across halfway and back in when the target is behind", () => {
        expect(stepPath(ends([0, 0], "right", [-100, 100], "left"))).toEqual({
            path: "M0,0 L20,0 L20,50 L-120,50 L-120,100 L-100,100",
            label: { x: -50, y: 50 },
        });
    });

    it("goes out to the farther end when both are on the same side", () => {
        expect(stepPath(ends([0, 0], "right", [100, 50], "right"))).toEqual({
            path: "M0,0 L120,0 L120,50 L100,50",
            label: { x: 95, y: 0 },
        });
    });

    it("takes one corner between perpendicular ends that reach it", () => {
        expect(stepPath(ends([0, 0], "right", [100, 100], "top"))).toEqual({
            path: "M0,0 L100,0 L100,100",
            label: { x: 100, y: 0 },
        });
    });

    it("stands both ends out when the corner is behind one", () => {
        expect(stepPath(ends([0, 0], "right", [-100, 100], "top"))).toEqual({
            path: "M0,0 L20,0 L20,80 L-100,80 L-100,100",
            label: { x: 0, y: 80 },
        });
    });

    it("takes the offset", () => {
        expect(
            stepPath({
                ...ends([0, 0], "bottom", [100, -100], "top"),
                offset: 10,
            }).path,
        ).toBe("M0,0 L0,10 L50,10 L50,-110 L100,-110 L100,-100");
    });
});

describe("smoothStepPath", () => {
    it("rounds every corner by the border radius", () => {
        expect(
            smoothStepPath(ends([0, 0], "right", [100, 50], "left")),
        ).toEqual({
            path: "M0,0 L45,0 Q50,0 50,5 L50,45 Q50,50 55,50 L100,50",
            label: { x: 50, y: 25 },
        });
        expect(
            smoothStepPath({
                ...ends([0, 0], "right", [100, 100], "top"),
                borderRadius: 10,
            }).path,
        ).toBe("M0,0 L90,0 Q100,0 100,10 L100,100");
    });

    it("rounds a corner by at most half its shorter segment", () => {
        expect(
            smoothStepPath({
                ...ends([0, 0], "right", [100, 4], "left"),
                borderRadius: 10,
            }).path,
        ).toBe("M0,0 L48,0 Q50,0 50,2 L50,2 Q50,4 52,4 L100,4");
    });
});

describe("the route helpers", () => {
    it("drop points that do not turn", () => {
        expect(
            orthogonalRoute(ends([0, 0], "right", [100, 0], "left"), 20),
        ).toEqual([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
        ]);
    });

    it("find the point halfway along a polyline", () => {
        expect(
            halfwayAlong([
                { x: 0, y: 0 },
                { x: 10, y: 0 },
                { x: 10, y: 30 },
            ]),
        ).toEqual({ x: 10, y: 10 });
        expect(halfwayAlong([{ x: 3, y: 4 }])).toEqual({ x: 3, y: 4 });
    });
});

describe("the turn's place: stepPosition, centerX, centerY", () => {
    it("puts the turn at stepPosition of the way, for the four facing side pairs", () => {
        const at = (path: ReturnType<typeof ends>) =>
            stepPath({ ...path, stepPosition: 0.25 });
        expect(at(ends([0, 0], "right", [100, 50], "left"))).toEqual({
            path: "M0,0 L35,0 L35,50 L100,50",
            label: { x: 35, y: 40 },
        });
        expect(at(ends([100, 0], "left", [0, 50], "right"))).toEqual({
            path: "M100,0 L65,0 L65,50 L0,50",
            label: { x: 65, y: 40 },
        });
        expect(at(ends([0, 0], "bottom", [50, 100], "top"))).toEqual({
            path: "M0,0 L0,35 L50,35 L50,100",
            label: { x: 40, y: 35 },
        });
        expect(at(ends([0, 100], "top", [50, 0], "bottom"))).toEqual({
            path: "M0,100 L0,65 L50,65 L50,0",
            label: { x: 40, y: 65 },
        });
        // 0.5 is the default route
        const plain = ends([0, 0], "right", [100, 50], "left");
        expect(smoothStepPath({ ...plain, stepPosition: 0.5 })).toEqual(
            smoothStepPath(plain),
        );
    });

    it("takes stepPosition between the stood-out points, so the ends keep their offset", () => {
        const facing = ends([0, 0], "right", [200, 60], "left");
        // offset 30: the stood-out points are at x 30 and x 170
        expect(stepPath({ ...facing, offset: 30, stepPosition: 0 }).path).toBe(
            "M0,0 L30,0 L30,60 L200,60",
        );
        expect(stepPath({ ...facing, offset: 30, stepPosition: 1 }).path).toBe(
            "M0,0 L170,0 L170,60 L200,60",
        );
        expect(
            stepPath({ ...facing, offset: 30, stepPosition: 0.1 }).path,
        ).toBe("M0,0 L44,0 L44,60 L200,60");
        // out of range is clamped to the stood-out points
        expect(stepPath({ ...facing, offset: 30, stepPosition: -2 }).path).toBe(
            "M0,0 L30,0 L30,60 L200,60",
        );
    });

    it("falls back to the default for a stepPosition, centerX or centerY that is not finite", () => {
        const facing = ends([0, 0], "right", [100, 50], "left");
        const down = ends([0, 0], "bottom", [50, 100], "top");
        const plain = stepPath(facing);
        for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
            expect(stepPath({ ...facing, stepPosition: bad })).toEqual(plain);
            expect(stepPath({ ...facing, centerX: bad })).toEqual(plain);
            expect(stepPath({ ...down, centerY: bad })).toEqual(stepPath(down));
            expect(
                smoothStepPath({ ...facing, stepPosition: bad }).path,
            ).not.toContain("NaN");
        }
        // a bad centerX still lets stepPosition place the turn
        expect(
            stepPath({ ...facing, centerX: Number.NaN, stepPosition: 0.25 }).path,
        ).toBe("M0,0 L35,0 L35,50 L100,50");
    });

    it("puts a vertical turn at centerX and a horizontal one at centerY, over stepPosition", () => {
        expect(
            stepPath({
                ...ends([0, 0], "right", [100, 50], "left"),
                centerX: 80,
                centerY: 999,
                stepPosition: 0.1,
            }),
        ).toEqual({
            path: "M0,0 L80,0 L80,50 L100,50",
            label: { x: 75, y: 0 },
        });
        expect(
            stepPath({
                ...ends([0, 0], "bottom", [50, 100], "top"),
                centerX: 999,
                centerY: 60,
            }),
        ).toEqual({
            path: "M0,0 L0,60 L50,60 L50,100",
            label: { x: 15, y: 60 },
        });
    });

    it("moves the run across when the target is behind", () => {
        const behind = ends([0, 0], "right", [-100, 100], "left");
        expect(stepPath({ ...behind, stepPosition: 0.25 }).path).toBe(
            "M0,0 L20,0 L20,25 L-120,25 L-120,100 L-100,100",
        );
        expect(stepPath({ ...behind, centerY: 80 }).path).toBe(
            "M0,0 L20,0 L20,80 L-120,80 L-120,100 L-100,100",
        );
        expect(
            stepPath({
                ...ends([0, 100], "bottom", [100, 0], "top"),
                centerX: 10,
            }).path,
        ).toBe("M0,100 L0,120 L10,120 L10,-20 L100,-20 L100,0");
        // a smooth step rounds the same route
        expect(
            smoothStepPath({ ...behind, stepPosition: 0.25, borderRadius: 0 }),
        ).toEqual(stepPath({ ...behind, stepPosition: 0.25 }));
    });
});
