// `simpleBezierPath`: control points on each end's side axis, halfway to the other end's
// projection on it; our own expected points for the four side pairs and a target behind.
import { describe, expect, it } from "vitest";
import { simpleBezierPath } from "../../src/geometry/simple-bezier-path";

describe("simpleBezierPath", () => {
    it("right to left: both control points halfway across", () => {
        expect(
            simpleBezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: 100, y: 50 },
                targetSide: "left",
            }),
        ).toEqual({
            path: "M0,0 C50,0 50,50 100,50",
            label: { x: 50, y: 25 },
        });
    });

    it("bottom to top: both control points halfway down", () => {
        expect(
            simpleBezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "bottom",
                target: { x: 60, y: 100 },
                targetSide: "top",
            }),
        ).toEqual({
            path: "M0,0 C0,50 60,50 60,100",
            label: { x: 30, y: 50 },
        });
    });

    it("right to top: each control point on its own axis", () => {
        expect(
            simpleBezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: 100, y: 100 },
                targetSide: "top",
            }),
        ).toEqual({
            path: "M0,0 C50,0 100,50 100,100",
            label: { x: 68.75, y: 31.25 },
        });
    });

    it("top to bottom with the target above", () => {
        expect(
            simpleBezierPath({
                source: { x: 0, y: 100 },
                sourceSide: "top",
                target: { x: 40, y: 0 },
                targetSide: "bottom",
            }),
        ).toEqual({
            path: "M0,100 C0,50 40,50 40,0",
            label: { x: 20, y: 50 },
        });
    });

    it("has no least reach: a target behind turns back at once, ends on one line go straight", () => {
        expect(
            simpleBezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: -100, y: 50 },
                targetSide: "left",
            }),
        ).toEqual({
            path: "M0,0 C-50,0 -50,50 -100,50",
            label: { x: -50, y: 25 },
        });
        expect(
            simpleBezierPath({
                source: { x: 0, y: 0 },
                sourceSide: "right",
                target: { x: 80, y: 0 },
                targetSide: "left",
            }).path,
        ).toBe("M0,0 C40,0 40,0 80,0");
    });

    it("a side and its opposite share an axis: the same curve", () => {
        const ends = { source: { x: 10, y: 20 }, target: { x: 90, y: 70 } };
        expect(
            simpleBezierPath({
                ...ends,
                sourceSide: "left",
                targetSide: "right",
            }),
        ).toEqual(
            simpleBezierPath({
                ...ends,
                sourceSide: "right",
                targetSide: "left",
            }),
        );
    });
});
