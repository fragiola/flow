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
