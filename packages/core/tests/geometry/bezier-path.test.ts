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
        ).toEqual({
            path: "M0,0 C50,0 50,50 100,50",
            label: { x: 50, y: 25 },
            labelOffset: { x: 50, y: 25 },
        });
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
            labelOffset: { x: 50, y: 0 },
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
        ).toEqual({
            path: "M0,0 C0,20 0,-10 0,10",
            label: { x: 0, y: 5 },
            labelOffset: { x: 0, y: 5 },
        });
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

    it("gives the label point's offset from the source, for the four side pairs", () => {
        const offset = (
            sourceSide: "top" | "right" | "bottom" | "left",
            target: { x: number; y: number },
            targetSide: "top" | "right" | "bottom" | "left",
        ) =>
            bezierPath({
                source: { x: 10, y: 10 },
                sourceSide,
                target,
                targetSide,
            }).labelOffset;
        // right to left, 200 across and 80 down: control points at (110, 10) and (110, 90)
        expect(offset("right", { x: 210, y: 90 }, "left")).toEqual({
            x: 100,
            y: 40,
        });
        // left to right, back across: (-90, 10) and (-90, -70), the label at (-90, -30)
        expect(offset("left", { x: -190, y: -70 }, "right")).toEqual({
            x: 100,
            y: 40,
        });
        // bottom to top, 60 across and 100 down: the label at (40, 60)
        expect(offset("bottom", { x: 70, y: 110 }, "top")).toEqual({
            x: 30,
            y: 50,
        });
        // top to bottom, up: the label at (40, -40)
        expect(offset("top", { x: 70, y: -90 }, "bottom")).toEqual({
            x: 30,
            y: 50,
        });
    });
});
