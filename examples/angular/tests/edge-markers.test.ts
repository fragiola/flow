import { describe, expect, it } from "vitest";
import {
    describeEnds,
    GEOMETRY,
    idPrefix,
    markerId,
    markersFor,
    markerUrl,
    SHAPES,
} from "../src/examples/edge-markers/markers";

// The edge-markers example's logic: the markers a set of edges needs, their ids inside one flow,
// and the words that name an edge's ends.

describe("markersFor", () => {
    it("defines each shape once per tone that uses it, and once for the selected state", () => {
        expect(
            markersFor([
                { end: "arrow", tone: "blue" },
                { start: "arrow", end: "arrow", tone: "green" },
                { start: "circle", tone: "blue" },
            ]),
        ).toEqual([
            { shape: "arrow", state: "blue" },
            { shape: "arrow", state: "green" },
            { shape: "arrow", state: "selected" },
            { shape: "circle", state: "blue" },
            { shape: "circle", state: "selected" },
        ]);
    });

    it("needs none for edges without markers", () => {
        expect(markersFor([{ tone: "neutral" }])).toEqual([]);
        expect(markersFor([])).toEqual([]);
    });
});

describe("the ids", () => {
    it("keep only characters a url(#…) takes as they are", () => {
        expect(idPrefix("«r1»")).toBe("markers-r1");
        expect(idPrefix(":r2:")).toBe("markers-r2");
        expect(idPrefix("_r_3_")).toBe("markers-_r_3_");
    });

    it("name a marker by its flow, shape and state", () => {
        expect(markerId("markers-r1", "diamond", "purple")).toBe(
            "markers-r1-diamond-purple",
        );
        expect(markerUrl("markers-r1", "arrow", "selected")).toBe(
            "url(#markers-r1-arrow-selected)",
        );
        expect(markerUrl("markers-r1", undefined, "blue")).toBeUndefined();
    });
});

describe("GEOMETRY", () => {
    it("draws every shape inside its 10 x 10 box, the edge's end on it", () => {
        for (const shape of SHAPES) {
            const { d, refX } = GEOMETRY[shape];
            const numbers = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
            expect(numbers.length, shape).toBeGreaterThan(0);
            for (const value of numbers) {
                expect(value, shape).toBeGreaterThanOrEqual(0);
                expect(value, shape).toBeLessThanOrEqual(10);
            }
            expect(refX, shape).toBeGreaterThan(5);
        }
    });
});

describe("describeEnds", () => {
    it("names the start and the end", () => {
        expect(
            describeEnds({ start: "circle", end: "open-arrow", tone: "blue" }),
        ).toBe("a circle at the start, an open arrow at the end");
        expect(describeEnds({ end: "arrow", tone: "blue" })).toBe(
            "an arrow at the end",
        );
        expect(describeEnds({ start: "diamond", tone: "blue" })).toBe(
            "a diamond at the start",
        );
        expect(describeEnds({ tone: "neutral" })).toBe("no markers");
    });
});
