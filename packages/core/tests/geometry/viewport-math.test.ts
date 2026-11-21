import { describe, expect, it } from "vitest";
import {
    centeredOn,
    fitBounds,
    keptInExtent,
    toFlow,
    toScreen,
    viewRect,
    zoomAround,
} from "../../src/geometry/viewport-math";

const size = { width: 800, height: 600 };

describe("the viewport's math", () => {
    it("converts points both ways", () => {
        const viewport = { x: 100, y: 50, zoom: 2 };
        expect(toFlow(viewport, { x: 300, y: 250 })).toEqual({
            x: 100,
            y: 100,
        });
        expect(toScreen(viewport, { x: 100, y: 100 })).toEqual({
            x: 300,
            y: 250,
        });
    });

    it("zooms around a point, which stays where it is", () => {
        const viewport = zoomAround({ x: 0, y: 0, zoom: 1 }, 2, {
            x: 100,
            y: 100,
        });
        expect(viewport).toEqual({ x: -100, y: -100, zoom: 2 });
        expect(toFlow(viewport, { x: 100, y: 100 })).toEqual({
            x: 100,
            y: 100,
        });
    });

    it("tells what the root shows and centres on a point", () => {
        expect(viewRect({ x: -100, y: 0, zoom: 2 }, size)).toEqual({
            x: 50,
            y: 0,
            width: 400,
            height: 300,
        });
        expect(centeredOn({ x: 10, y: 10 }, 1, size)).toEqual({
            x: 390,
            y: 290,
            zoom: 1,
        });
    });

    it("fits bounds with padding, within the zoom limits", () => {
        const bounds = { x: 0, y: 0, width: 100, height: 50 };
        expect(fitBounds(bounds, size, 0.1, 0.5, 2)).toEqual({
            x: 300,
            y: 250,
            zoom: 2,
        });
        expect(fitBounds(bounds, size, 0.1, 0.5, 10)).toEqual({
            x: 80,
            y: 140,
            zoom: 6.4,
        });
        expect(
            fitBounds({ x: 0, y: 0, width: 0, height: 0 }, size, 0.1, 0.5, 2)
                .zoom,
        ).toBe(2);
    });

    it("keeps the view inside a translate extent", () => {
        const extent = { x: 0, y: 0, width: 1000, height: 1000 };
        expect(keptInExtent({ x: 100, y: 100, zoom: 1 }, size, extent)).toEqual(
            {
                x: 0,
                y: 0,
                zoom: 1,
            },
        );
        expect(
            keptInExtent({ x: -300, y: -500, zoom: 1 }, size, extent),
        ).toEqual({
            x: -200,
            y: -400,
            zoom: 1,
        });
        expect(
            keptInExtent({ x: 0, y: 0, zoom: 1 }, size, {
                x: 0,
                y: 0,
                width: 400,
                height: 300,
            }),
        ).toEqual({ x: 200, y: 150, zoom: 1 });
    });
});
