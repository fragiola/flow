import { describe, expect, it } from "vitest";
import {
    anyCollision,
    collide,
    overlapOf,
    resolveCollisions,
} from "../src/examples/intersections/collisions";
import {
    insideBox,
    pathCrossesBox,
    pathRuns,
    segmentCrossesBox,
} from "../src/examples/intersections/crossing";

// The intersections example's framework-free helpers: reading an edge's path data, whether it
// crosses a node's box, and the resolver that pushes overlapping nodes apart.

const box = (x: number, y: number, width = 100, height = 40) => ({
    x,
    y,
    width,
    height,
});
const at = (id: string, x: number, y: number) => ({ id, box: box(x, y) });

describe("pathRuns", () => {
    it("reads straight lines as they are", () => {
        expect(pathRuns("M0,0 L100,50")).toEqual([
            [
                { x: 0, y: 0 },
                { x: 100, y: 50 },
            ],
        ]);
    });

    it("reads H, V, Z and relative commands", () => {
        expect(pathRuns("M10,10 h20 v20 H10 z")).toEqual([
            [
                { x: 10, y: 10 },
                { x: 30, y: 10 },
                { x: 30, y: 30 },
                { x: 10, y: 30 },
                { x: 10, y: 10 },
            ],
        ]);
    });

    it("samples a cubic curve through its ends", () => {
        const [run] = pathRuns("M0,0 C50,0 50,100 100,100", 4);
        expect(run).toHaveLength(5);
        expect(run?.[0]).toEqual({ x: 0, y: 0 });
        expect(run?.[2]).toEqual({ x: 50, y: 50 });
        expect(run?.[4]).toEqual({ x: 100, y: 100 });
    });

    it("samples a quadratic corner (a smooth step's)", () => {
        const [run] = pathRuns("M0,0 L40,0 Q50,0 50,10 L50,60", 2);
        expect(run).toEqual([
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 47.5, y: 2.5 },
            { x: 50, y: 10 },
            { x: 50, y: 60 },
        ]);
    });

    it("starts a new run on a move, and reads nothing from no path", () => {
        expect(pathRuns("M0,0 L10,0 M20,0 L30,0")).toHaveLength(2);
        expect(pathRuns("")).toEqual([]);
        expect(pathRuns("M5,5")).toEqual([]);
    });
});

describe("segmentCrossesBox", () => {
    const area = box(0, 0, 100, 100);

    it("sees a segment through the box", () => {
        expect(
            segmentCrossesBox({ x: -50, y: 50 }, { x: 150, y: 50 }, area),
        ).toBe(true);
        expect(
            segmentCrossesBox({ x: -10, y: -10 }, { x: 110, y: 110 }, area),
        ).toBe(true);
    });

    it("sees a segment wholly inside or ending inside", () => {
        expect(
            segmentCrossesBox({ x: 10, y: 10 }, { x: 20, y: 20 }, area),
        ).toBe(true);
        expect(
            segmentCrossesBox({ x: -50, y: 50 }, { x: 50, y: 50 }, area),
        ).toBe(true);
    });

    it("misses a segment beside, above or short of the box", () => {
        expect(
            segmentCrossesBox({ x: -50, y: 150 }, { x: 150, y: 150 }, area),
        ).toBe(false);
        expect(
            segmentCrossesBox({ x: 120, y: -50 }, { x: 120, y: 150 }, area),
        ).toBe(false);
        expect(
            segmentCrossesBox({ x: -50, y: 50 }, { x: -10, y: 50 }, area),
        ).toBe(false);
        // diagonal past a corner
        expect(
            segmentCrossesBox({ x: 150, y: 0 }, { x: 200, y: -60 }, area),
        ).toBe(false);
    });
});

describe("insideBox", () => {
    it("counts the border in", () => {
        expect(insideBox({ x: 0, y: 40 }, box(0, 0))).toBe(true);
        expect(insideBox({ x: 101, y: 0 }, box(0, 0))).toBe(false);
    });
});

describe("pathCrossesBox", () => {
    it("sees a straight edge through a box", () => {
        expect(pathCrossesBox("M0,28 L520,28", box(260, 0, 140, 56))).toBe(
            true,
        );
        expect(pathCrossesBox("M0,28 L520,28", box(260, 60, 140, 56))).toBe(
            false,
        );
    });

    it("sees a bezier edge where its curve passes, not where its chord does", () => {
        // from (0,0) to (200,200), bowing out to the top right
        const d = "M0,0 C200,0 200,0 200,200";
        expect(pathCrossesBox(d, box(150, 10, 30, 30))).toBe(true);
        // the straight chord would cross this box near (60,60); the curve does not
        expect(pathCrossesBox(d, box(40, 50, 30, 30))).toBe(false);
    });

    it("reads no path as crossing nothing", () => {
        expect(pathCrossesBox("", box(0, 0))).toBe(false);
    });
});

describe("collide", () => {
    it("is true when the boxes share area, or come closer than the margin", () => {
        expect(collide(box(0, 0), box(50, 20))).toBe(true);
        expect(collide(box(0, 0), box(100, 0))).toBe(false);
        expect(collide(box(0, 0), box(110, 0), 16)).toBe(true);
        expect(collide(box(0, 0), box(116, 0), 16)).toBe(false);
    });

    it("measures the overlap on each axis", () => {
        expect(overlapOf(box(0, 0), box(80, 30))).toEqual({ x: 20, y: 10 });
    });
});

describe("resolveCollisions", () => {
    it("moves nothing when nothing overlaps", () => {
        expect(resolveCollisions([at("a", 0, 0), at("b", 200, 0)])).toEqual([]);
    });

    it("pushes a free node away from a fixed one, along the axis of least overlap", () => {
        // b overlaps a by 20 across and 30 down: it goes right by 20 (plus the margin)
        const moved = resolveCollisions([at("a", 0, 0), at("b", 80, 10)], {
            fixed: ["a"],
            margin: 10,
        });
        expect(moved).toEqual([{ id: "b", position: { x: 110, y: 10 } }]);
    });

    it("pushes the other way when the free node is on the other side", () => {
        const moved = resolveCollisions([at("a", 0, 0), at("b", -10, 30)], {
            fixed: ["a"],
        });
        // 90 across, 10 down: b goes down
        expect(moved).toEqual([{ id: "b", position: { x: -10, y: 40 } }]);
    });

    it("moves the later of two free nodes", () => {
        const moved = resolveCollisions([at("a", 0, 0), at("b", 80, 0)]);
        expect(moved).toEqual([{ id: "b", position: { x: 100, y: 0 } }]);
    });

    it("moves a node given before a fixed one", () => {
        const moved = resolveCollisions([at("a", 80, 0), at("drop", 0, 0)], {
            fixed: ["drop"],
        });
        expect(moved).toEqual([{ id: "a", position: { x: 100, y: 0 } }]);
    });

    it("leaves no overlap in a pile, and keeps the fixed node where it is", () => {
        const pile = [
            at("drop", 0, 0),
            at("b", 10, 5),
            at("c", 20, 10),
            at("d", -15, 20),
            at("e", 5, -10),
        ];
        const moved = resolveCollisions(pile, { fixed: ["drop"], margin: 8 });
        expect(moved.map((item) => item.id)).not.toContain("drop");
        const after = pile.map((item) => {
            const found = moved.find((entry) => entry.id === item.id);
            return found
                ? { id: item.id, box: { ...item.box, ...found.position } }
                : item;
        });
        expect(anyCollision(after, 8)).toBe(false);
    });

    it("never moves two fixed nodes", () => {
        expect(
            resolveCollisions([at("a", 0, 0), at("b", 10, 0)], {
                fixed: ["a", "b"],
            }),
        ).toEqual([]);
    });
});
