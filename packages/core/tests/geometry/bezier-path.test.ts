import { describe, expect, it } from "vitest";
import { bezierPath } from "../../src/geometry/bezier-path";

describe("bezierPath", () => {
    it("stands each control point out by half the distance along its side", () => {
        expect(
            bezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: 100, y: 50 },
                targetSide: "left",
            }),
        ).toEqual({ path: "M0,0 C50,0 50,50 100,50", label: { x: 50, y: 25 } });
    });

    it("bends out before turning back when the other end is behind", () => {
        expect(
            bezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: -100, y: 0 },
                targetSide: "left",
            }),
        ).toEqual({
            path: "M0,0 C50,0 -150,0 -100,0",
            label: { x: -50, y: 0 },
        });
    });

    it("never stands a control point out by less than 20", () => {
        expect(
            bezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "bottom",
                target: { x: 0, y: 10 },
                targetSide: "top",
            }),
        ).toEqual({ path: "M0,0 C0,20 0,-10 0,10", label: { x: 0, y: 5 } });
    });

    it("takes a curvature", () => {
        expect(
            bezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: 100, y: 50 },
                targetSide: "left",
                curvature: 0.25,
            }).path,
        ).toBe("M0,0 C25,0 75,50 100,50");
    });

    it("writes at most two decimals", () => {
        expect(
            bezierPath({
                source: { x: 1 / 3, y: 0 },
                sourceSide: "top",
                target: { x: 2 / 3, y: -100 },
                targetSide: "bottom",
            }).path,
        ).toBe("M0.33,0 C0.33,-50 0.67,-50 0.67,-100");
    });
});
