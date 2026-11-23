import { describe, expect, it } from "vitest";
import {
    closestWithin,
    gapBetween,
    linkBetween,
    linked,
    proximityLink,
    sameLink,
} from "../src/examples/proximity-connect/proximity";

// The proximity-connect example's geometry: the gap between two boxes, the closest node within a
// distance, which way the new edge runs and where its temporary line is drawn.

const box = (x: number, y: number) => ({ x, y, width: 100, height: 40 });
const at = (id: string, x: number, y: number) => ({ id, box: box(x, y) });

describe("gapBetween", () => {
    it("is the empty space along an axis when the boxes face each other", () => {
        expect(gapBetween(box(0, 0), box(130, 0))).toBe(30);
        expect(gapBetween(box(130, 0), box(0, 0))).toBe(30);
        expect(gapBetween(box(0, 0), box(0, 60))).toBe(20);
    });

    it("is the corner-to-corner distance when they are diagonal", () => {
        expect(gapBetween(box(0, 0), box(130, 80))).toBe(50);
    });

    it("is 0 when they touch or overlap", () => {
        expect(gapBetween(box(0, 0), box(100, 0))).toBe(0);
        expect(gapBetween(box(0, 0), box(50, 20))).toBe(0);
    });
});

describe("closestWithin", () => {
    const candidates = [
        at("far", 400, 0),
        at("near", 120, 0),
        at("mid", 150, 0),
    ];

    it("finds the candidate with the smallest gap", () => {
        expect(closestWithin(box(0, 0), candidates, 80)?.id).toBe("near");
    });

    it("finds none beyond the distance", () => {
        expect(closestWithin(box(0, 0), candidates, 10)).toBeUndefined();
        expect(closestWithin(box(0, 0), [], 80)).toBeUndefined();
    });

    it("keeps a gap equal to the distance, and the first on a tie", () => {
        expect(
            closestWithin(box(0, 0), [at("a", 180, 0), at("b", 0, 120)], 80)
                ?.id,
        ).toBe("a");
    });
});

describe("linkBetween", () => {
    it("runs from the node further left, right side to left side", () => {
        const link = linkBetween(at("right", 300, 100), at("left", 0, 0));
        expect(link).toEqual({
            source: "left",
            target: "right",
            from: { x: 100, y: 20 },
            to: { x: 300, y: 120 },
        });
    });

    it("runs from the upper node when they are aligned", () => {
        const link = linkBetween(at("low", 0, 100), at("high", 0, 0));
        expect(link.source).toBe("high");
        expect(link.target).toBe("low");
    });
});

describe("linked", () => {
    const edges = [{ source: "a", target: "b" }];

    it("sees an edge either way", () => {
        expect(linked(edges, "a", "b")).toBe(true);
        expect(linked(edges, "b", "a")).toBe(true);
        expect(linked(edges, "a", "c")).toBe(false);
    });
});

describe("proximityLink", () => {
    const a = at("a", 0, 0);
    const nodes = [a, at("b", 150, 0), at("c", 0, 70)];

    it("links the dragged node to the closest node it is not joined to", () => {
        // c is 30 below a, b 50 to its right
        expect(proximityLink(a, nodes, [], 80)).toMatchObject({
            source: "a",
            target: "c",
        });
        expect(
            proximityLink(a, nodes, [{ source: "c", target: "a" }], 80),
        ).toMatchObject({ source: "a", target: "b" });
    });

    it("never links a node to itself, nor beyond the distance", () => {
        expect(proximityLink(a, [a], [], 80)).toBeUndefined();
        expect(proximityLink(a, nodes, [], 20)).toBeUndefined();
    });
});

describe("sameLink", () => {
    const link = linkBetween(at("a", 0, 0), at("b", 200, 0));

    it("compares the ends and the points", () => {
        expect(sameLink(link, { ...link })).toBe(true);
        expect(sameLink(link, { ...link, to: { x: 201, y: 20 } })).toBe(false);
        expect(sameLink(link, { ...link, target: "c" })).toBe(false);
        expect(sameLink(undefined, undefined)).toBe(true);
        expect(sameLink(link, undefined)).toBe(false);
    });
});
