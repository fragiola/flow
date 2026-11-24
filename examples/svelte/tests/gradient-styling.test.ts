import { describe, expect, it } from "vitest";
import {
    describeStep,
    edgeGradient,
    gradientId,
    gradientUrl,
    idPrefix,
    KIND_GRADIENTS,
    KINDS,
    TONES,
} from "../src/examples/gradient-styling/gradients";

// The gradient-styling example's logic: each kind's two palettes, an edge's gradient between its
// nodes' colours, the gradients' ids inside one flow, and the words that name a step.

describe("KIND_GRADIENTS", () => {
    it("runs every kind between two different palettes", () => {
        for (const kind of KINDS) {
            const { from, to } = KIND_GRADIENTS[kind];
            expect(TONES, kind).toContain(from);
            expect(TONES, kind).toContain(to);
            expect(from, kind).not.toBe(to);
        }
    });

    it("gives every kind a colour of its own", () => {
        const own = KINDS.map((kind) => KIND_GRADIENTS[kind].from);
        expect(new Set(own).size).toBe(KINDS.length);
    });
});

describe("edgeGradient", () => {
    it("runs from the source's own colour to the target's", () => {
        expect(edgeGradient("source", "transform")).toEqual({
            from: "blue",
            to: "purple",
        });
        expect(edgeGradient("check", "output")).toEqual({
            from: "orange",
            to: "green",
        });
    });
});

describe("the ids", () => {
    it("keep only characters a url(#…) takes as they are", () => {
        expect(idPrefix("«r1»")).toBe("gradient-r1");
        expect(idPrefix(":r2:")).toBe("gradient-r2");
        expect(idPrefix("_r_3_")).toBe("gradient-_r_3_");
    });

    it("name an edge's gradient by its flow and the edge", () => {
        expect(gradientId("gradient-r1", "events-parse")).toBe(
            "gradient-r1-events-parse",
        );
        expect(gradientId("gradient-r1", "a b.c#d")).toBe(
            "gradient-r1-a_b_c_d",
        );
        expect(gradientUrl("gradient-r1", "events-parse")).toBe(
            "url(#gradient-r1-events-parse)",
        );
    });
});

describe("describeStep", () => {
    it("names a step by its label, kind and detail", () => {
        expect(describeStep("Parse", "transform", "JSON lines to rows")).toBe(
            "Parse, a transform step: JSON lines to rows",
        );
        expect(describeStep("Report", "output", "daily summary")).toBe(
            "Report, an output step: daily summary",
        );
    });
});
