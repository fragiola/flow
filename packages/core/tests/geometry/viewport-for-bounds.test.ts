import { describe, expect, it } from "vitest";
import { viewportForBounds } from "../../src/geometry/viewport-for-bounds";

describe("viewportForBounds", () => {
    const bounds = { x: 0, y: 0, width: 100, height: 50 };

    it("fits bounds with padding, within the zoom limits (fit-view's numbers)", () => {
        expect(
            viewportForBounds(bounds, 800, 600, {
                padding: 0.1,
                minZoom: 0.5,
                maxZoom: 2,
            }),
        ).toEqual({ x: 300, y: 250, zoom: 2 });
        expect(
            viewportForBounds(bounds, 800, 600, {
                padding: 0.1,
                minZoom: 0.5,
                maxZoom: 10,
            }),
        ).toEqual({ x: 80, y: 140, zoom: 6.4 });
        expect(
            viewportForBounds({ x: 0, y: 0, width: 0, height: 0 }, 800, 600)
                .zoom,
        ).toBe(2);
    });

    it("defaults: padding 0.1, zoom between 0.5 and 2", () => {
        expect(viewportForBounds(bounds, 800, 600)).toEqual(
            viewportForBounds(bounds, 800, 600, {
                padding: 0.1,
                minZoom: 0.5,
                maxZoom: 2,
            }),
        );
        // too big for the least zoom: the least zoom, centred
        expect(
            viewportForBounds(
                { x: -1000, y: -1000, width: 10_000, height: 10_000 },
                800,
                600,
            ),
        ).toEqual({ x: 400 - 4000 * 0.5, y: 300 - 4000 * 0.5, zoom: 0.5 });
    });

    it("the narrower side decides, and the rectangle is centred", () => {
        // 400 × 100 in 800 × 600, no padding: the width gives 2, the height 6
        expect(
            viewportForBounds(
                { x: 100, y: 100, width: 400, height: 100 },
                800,
                600,
                {
                    padding: 0,
                    maxZoom: 10,
                },
            ),
        ).toEqual({ x: -200, y: 0, zoom: 2 });
        // half the room padded away on each side leaves none: the least zoom
        expect(viewportForBounds(bounds, 800, 600, { padding: 0.5 }).zoom).toBe(
            0.5,
        );
    });
});
