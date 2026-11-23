// The uniform grid of rectangles: its queries give what a scan of every rectangle gives (touching
// included), through moves and removals, for small, large, far, empty and touching rectangles.
import { describe, expect, it } from "vitest";
import { overlaps } from "../../src/geometry/rect";
import { SpatialGrid } from "../../src/geometry/spatial-grid";
import type { Rect } from "../../src/geometry/types";

const rect = (x: number, y: number, width: number, height: number): Rect => ({
    x,
    y,
    width,
    height,
});

const sorted = (ids: string[]) => [...ids].sort();

describe("SpatialGrid", () => {
    it("finds the rectangles meeting an area, touching ones included", () => {
        const grid = new SpatialGrid(100);
        grid.set("a", rect(0, 0, 50, 50));
        grid.set("b", rect(150, 0, 50, 50));
        grid.set("c", rect(50, 50, 0, 0));
        grid.set("d", rect(-500, -500, 10, 10));
        expect(sorted(grid.query(rect(0, 0, 60, 60)))).toEqual(["a", "c"]);
        // a side touching the area counts, as `overlaps`
        expect(grid.query(rect(200, 0, 10, 10))).toEqual(["b"]);
        expect(grid.query(rect(-495, -495, 1, 1))).toEqual(["d"]);
        expect(grid.query(rect(1000, 1000, 10, 10))).toEqual([]);
        expect(grid.size).toBe(4);
    });

    it("moves and forgets rectangles", () => {
        const grid = new SpatialGrid(100);
        grid.set("a", rect(0, 0, 50, 50));
        grid.set("a", rect(1000, 1000, 50, 50));
        expect(grid.query(rect(0, 0, 60, 60))).toEqual([]);
        expect(grid.query(rect(1000, 1000, 1, 1))).toEqual(["a"]);
        expect(grid.get("a")).toEqual(rect(1000, 1000, 50, 50));
        grid.delete("a");
        expect(grid.has("a")).toBe(false);
        expect(grid.query(rect(1000, 1000, 1, 1))).toEqual([]);
        grid.set("b", rect(0, 0, 1, 1));
        grid.clear();
        expect(grid.size).toBe(0);
        expect(grid.query(rect(0, 0, 1, 1))).toEqual([]);
    });

    it("keeps a rectangle spanning many cells, or out of reach, in the list every query checks", () => {
        const grid = new SpatialGrid(10);
        grid.set("wide", rect(-5000, 0, 10_000, 10));
        grid.set("far", rect(1e12, 1e12, 10, 10));
        grid.set("odd", rect(Number.NaN, 0, 10, 10));
        grid.set("small", rect(0, 0, 5, 5));
        expect(sorted(grid.query(rect(4000, 0, 1, 1)))).toEqual(["wide"]);
        expect(grid.query(rect(1e12, 1e12, 1, 1))).toEqual(["far"]);
        expect(sorted(grid.query(rect(0, 0, 1, 1)))).toEqual(["small", "wide"]);
    });

    it("answers as a scan of every rectangle, for random rectangles, moves, removals and areas", () => {
        let state = 7;
        const random = () => {
            state = (state * 1103515245 + 12345) % 2147483648;
            return state / 2147483648;
        };
        const between = (min: number, max: number) =>
            Math.round(min + random() * (max - min));
        for (const cell of [16, 100, 256]) {
            const grid = new SpatialGrid(cell);
            const all = new Map<string, Rect>();
            for (let step = 0; step < 2000; step++) {
                const id = `r${between(0, 300)}`;
                const roll = random();
                if (roll < 0.15) {
                    grid.delete(id);
                    all.delete(id);
                } else if (roll < 0.8) {
                    const r =
                        random() < 0.05
                            ? rect(
                                  between(-5000, 0),
                                  between(-5000, 0),
                                  8000,
                                  300,
                              )
                            : rect(
                                  between(-2000, 2000),
                                  between(-2000, 2000),
                                  between(0, 300),
                                  between(0, 200),
                              );
                    grid.set(id, r);
                    all.set(id, r);
                } else {
                    const area =
                        random() < 0.1
                            ? rect(-1e6, -1e6, 2e6, 2e6)
                            : rect(
                                  between(-2500, 2500),
                                  between(-2500, 2500),
                                  between(0, 1500),
                                  between(0, 1000),
                              );
                    const expected = [...all]
                        .filter(([, r]) => overlaps(r, area))
                        .map(([key]) => key);
                    expect(sorted(grid.query(area))).toEqual(sorted(expected));
                }
            }
            expect(grid.size).toBe(all.size);
        }
    });
});
