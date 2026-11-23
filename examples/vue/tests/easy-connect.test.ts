import { describe, expect, it } from "vitest";
import {
    borderPoint,
    floatingLine,
} from "../src/examples/easy-connect/floating-edge";

// The easy-connect example's floating edge: a line between two nodes' centres, cut at each node's
// border.

const SIZE = { width: 140, height: 56 };

describe("borderPoint", () => {
    it("meets the side the line leaves by", () => {
        const center = { x: 100, y: 100 };
        expect(borderPoint(center, { x: 400, y: 100 }, SIZE)).toEqual({
            x: 170,
            y: 100,
        });
        expect(borderPoint(center, { x: 100, y: -300 }, SIZE)).toEqual({
            x: 100,
            y: 72,
        });
        expect(borderPoint(center, { x: -50, y: 100 }, SIZE)).toEqual({
            x: 30,
            y: 100,
        });
    });

    it("meets the nearer pair of sides on a slanted line", () => {
        // steep: the bottom side first
        const steep = borderPoint({ x: 0, y: 0 }, { x: 10, y: 100 }, SIZE);
        expect(steep.y).toBeCloseTo(28);
        expect(steep.x).toBeCloseTo(2.8);
        // shallow: the right side first
        const shallow = borderPoint({ x: 0, y: 0 }, { x: 100, y: 10 }, SIZE);
        expect(shallow.x).toBeCloseTo(70);
        expect(shallow.y).toBeCloseTo(7);
    });

    it("keeps the centre when both points are the same", () => {
        expect(borderPoint({ x: 5, y: 5 }, { x: 5, y: 5 }, SIZE)).toEqual({
            x: 5,
            y: 5,
        });
    });
});

describe("floatingLine", () => {
    it("draws a straight line from border to border", () => {
        const line = floatingLine({ x: 0, y: 0 }, { x: 300, y: 0 }, SIZE);
        expect(line.source).toEqual({ x: 70, y: 0 });
        expect(line.target).toEqual({ x: 230, y: 0 });
        expect(line.path).toBe("M 70,0 L 230,0");
    });

    it("follows the nodes whichever way they face each other", () => {
        const line = floatingLine({ x: 0, y: 200 }, { x: 0, y: 0 }, SIZE);
        expect(line.source).toEqual({ x: 0, y: 172 });
        expect(line.target.x).toBe(0);
        expect(line.target.y).toBeCloseTo(28);
    });
});
