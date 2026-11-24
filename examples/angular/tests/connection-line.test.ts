import { describe, expect, it } from "vitest";
import {
    edgesToAdd,
    elbowPath,
    otherSources,
    sameStarts,
} from "../src/examples/connection-line/multi-connection";

// The connection-line example's logic: the elbow its line draws, the other selected nodes a
// connection also starts from, and the edges the drop adds for them.

describe("elbowPath", () => {
    it("goes across to the middle, down to the end's height and across, corners rounded", () => {
        expect(elbowPath({ x: 0, y: 0 }, { x: 100, y: 60 }, 10)).toBe(
            "M 0,0 H 40 Q 50,0 50,10 V 50 Q 50,60 60,60 H 100",
        );
    });

    it("turns the other way when the end is above and to the left", () => {
        expect(elbowPath({ x: 100, y: 60 }, { x: 0, y: 0 }, 10)).toBe(
            "M 100,60 H 60 Q 50,60 50,50 V 10 Q 50,0 40,0 H 0",
        );
    });

    it("rounds less when the elbow is too short for the radius", () => {
        expect(elbowPath({ x: 0, y: 0 }, { x: 100, y: 8 }, 10)).toBe(
            "M 0,0 H 46 Q 50,0 50,4 V 4 Q 50,8 54,8 H 100",
        );
    });

    it("is a straight line when the ends are level or one above the other", () => {
        expect(elbowPath({ x: 0, y: 5 }, { x: 80, y: 5 })).toBe("M 0,5 L 80,5");
        expect(elbowPath({ x: 5, y: 0 }, { x: 5, y: 80 })).toBe("M 5,0 L 5,80");
    });
});

describe("otherSources", () => {
    it("is the rest of the selection when the node pressed is in it", () => {
        expect(otherSources("a", ["a", "b", "c"])).toEqual(["b", "c"]);
        expect(otherSources("a", ["a"])).toEqual([]);
    });

    it("is none when the node pressed is not selected", () => {
        expect(otherSources("a", ["b", "c"])).toEqual([]);
        expect(otherSources("a", [])).toEqual([]);
    });
});

describe("edgesToAdd", () => {
    it("adds one edge per source into the target and its handle", () => {
        expect(edgesToAdd(["b", "c"], "t", "in", [])).toEqual([
            { id: "b-t", source: "b", target: "t", targetHandle: "in" },
            { id: "c-t", source: "c", target: "t", targetHandle: "in" },
        ]);
        expect(edgesToAdd(["b"], "t", undefined, [])).toEqual([
            { id: "b-t", source: "b", target: "t" },
        ]);
    });

    it("skips the target itself, a repeated source and an edge that exists", () => {
        const edges = [{ source: "c", target: "t" }];
        expect(
            edgesToAdd(["b", "t", "b", "c"], "t", undefined, edges).map(
                (edge) => edge.source,
            ),
        ).toEqual(["b"]);
    });

    it("keeps an edge into another handle of the same target", () => {
        const edges = [{ source: "c", target: "t", targetHandle: "x" }];
        expect(edgesToAdd(["c"], "t", "y", edges)).toHaveLength(1);
    });
});

describe("sameStarts", () => {
    const start = { id: "a", x: 1, y: 2 };

    it("compares the ids and the points", () => {
        expect(sameStarts([start], [{ ...start }])).toBe(true);
        expect(sameStarts([], [])).toBe(true);
        expect(sameStarts([start], [{ ...start, y: 3 }])).toBe(false);
        expect(sameStarts([start], [{ ...start, id: "b" }])).toBe(false);
        expect(sameStarts([start], [])).toBe(false);
    });
});
