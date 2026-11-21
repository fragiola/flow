import { describe, expect, it } from "vitest";
import { backgroundPattern } from "../../src/engine/background-pattern";

describe("background-pattern", () => {
    const viewport = { x: 13, y: 7, zoom: 2 };

    it("puts a dot on every grid point, the tile following the viewport", () => {
        expect(backgroundPattern(viewport, {})).toEqual({
            variant: "dots",
            x: 33,
            y: 27,
            width: 40,
            height: 40,
            dot: { cx: 20, cy: 20, r: 1 },
            path: undefined,
            strokeWidth: 0,
        });
    });

    it("draws lines and crosses", () => {
        expect(backgroundPattern(viewport, { variant: "lines" })).toMatchObject(
            {
                path: "M20,0 V40 M0,20 H40",
                strokeWidth: 1,
                dot: undefined,
            },
        );
        expect(backgroundPattern(viewport, { variant: "cross" })).toMatchObject(
            {
                path: "M14,20 H26 M20,14 V26",
                strokeWidth: 1,
            },
        );
    });

    it("takes two gaps and an offset", () => {
        expect(
            backgroundPattern(
                { x: 0, y: 0, zoom: 1 },
                { gap: [10, 20], offset: 5 },
            ),
        ).toMatchObject({ x: 0, y: 15, width: 10, height: 20 });
    });
});
