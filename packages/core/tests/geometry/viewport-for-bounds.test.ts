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

describe("viewportForBounds per-side padding", () => {
    const bounds = { x: 0, y: 0, width: 200, height: 100 };

    it("keeps a plain number exactly as before, and a uniform object the same", () => {
        // 1000 × 500 root, 0.1 each side: 800 × 400 room, zoom 4 capped at 2
        expect(
            viewportForBounds(bounds, 1000, 500, { padding: 0.1, maxZoom: 10 }),
        ).toEqual({ x: 100, y: 50, zoom: 4 });
        const sides = viewportForBounds(bounds, 1000, 500, {
            padding: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
            maxZoom: 10,
        });
        expect(sides.zoom).toBeCloseTo(4);
        expect(sides.x).toBeCloseTo(100);
        expect(sides.y).toBeCloseTo(50);
    });

    it("centres the bounds in the room each side leaves, shares and pixels", () => {
        // left 100 px, right 0.2 × 1000 = 200, top 50 px, bottom none: 700 × 450 room
        // zoom min(700 / 200, 450 / 100) = 3.5; 700 left, 350 tall, centred in the room
        expect(
            viewportForBounds(bounds, 1000, 500, {
                padding: { left: "100px", right: 0.2, top: "50px" },
                maxZoom: 10,
            }),
        ).toEqual({ x: 100, y: 100, zoom: 3.5 });
        // "20px" on every side: 960 × 460 room, zoom 4.6, height-bound
        const pixels = viewportForBounds(bounds, 1000, 500, {
            padding: "20px",
            maxZoom: 10,
        });
        expect(pixels.zoom).toBeCloseTo(4.6);
        expect(pixels.x).toBeCloseTo(40);
        expect(pixels.y).toBeCloseTo(20);
    });
});
