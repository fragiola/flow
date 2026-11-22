// @vitest-environment jsdom
// `viewport-for-bounds`: the viewport `fit-view` would set for a flow rectangle in the root (the
// pure `viewportForBounds` with the engine's zoom limits and translate extent), and `fit-view`
// unchanged on top of it.
import { afterEach, describe, expect, it } from "vitest";
import { viewportForBounds } from "../../src/geometry/viewport-for-bounds";
import { flowOf, mount, unmountAll } from "./harness";

afterEach(unmountAll);

describe("viewport-for-bounds", () => {
    const bounds = { x: 0, y: 0, width: 400, height: 150 };

    it("is what fit-view sets for the same rectangle, and sets nothing", () => {
        const { engine } = mount(flowOf({ a: [0, 0], b: [300, 100] }), {
            sizes: { a: [100, 100], b: [100, 50] },
            engine: { maxZoom: 4 },
        });
        const read = engine.get("viewport-for-bounds", { bounds });
        expect(read).toEqual({ x: 80, y: 180, zoom: 1.6 });
        expect(engine.get("viewport")).toEqual({ x: 0, y: 0, zoom: 1 });
        expect(engine.run("fit-view", {})).toEqual({ ok: true, value: read });
        for (const options of [
            { padding: 0 },
            { padding: 0.3, maxZoom: 1 },
            { minZoom: 3 },
        ]) {
            expect(engine.check("fit-view", options)).toEqual({
                ok: true,
                value: engine.get("viewport-for-bounds", {
                    bounds,
                    ...options,
                }),
            });
        }
    });

    it("is the pure viewportForBounds with the engine's zoom limits", () => {
        const { engine } = mount(flowOf({}), {
            root: { left: 50, top: 60, width: 500, height: 400 },
            engine: { minZoom: 0.25, maxZoom: 8 },
        });
        const rect = { x: -40, y: 25, width: 120, height: 300 };
        expect(engine.get("viewport-for-bounds", { bounds: rect })).toEqual(
            viewportForBounds(rect, 500, 400, { minZoom: 0.25, maxZoom: 8 }),
        );
        // its own limits narrow the engine's, never widen them
        expect(
            engine.get("viewport-for-bounds", {
                bounds: { x: 0, y: 0, width: 1, height: 1 },
                maxZoom: 20,
            })?.zoom,
        ).toBe(8);
        expect(
            engine.get("viewport-for-bounds", { bounds: rect, maxZoom: 1 })
                ?.zoom,
        ).toBe(1);
    });

    it("keeps the translate extent, as fit-view does", () => {
        const extent = { x: 0, y: 0, width: 1000, height: 1000 };
        const { engine } = mount(flowOf({}), {
            engine: { translateExtent: extent },
        });
        const corner = { x: 0, y: 0, width: 10, height: 10 };
        // centred at zoom 2, the corner would show the flow left of and above the extent
        expect(viewportForBounds(corner, 800, 600)).toEqual({
            x: 390,
            y: 290,
            zoom: 2,
        });
        expect(engine.get("viewport-for-bounds", { bounds: corner })).toEqual({
            x: 0,
            y: 0,
            zoom: 2,
        });
    });

    it("is undefined without a root size or a rectangle", () => {
        const sized = mount(flowOf({}));
        const get = sized.engine.get as (
            key: string,
            payload?: unknown,
        ) => unknown;
        expect(get("viewport-for-bounds")).toBeUndefined();
        expect(
            get("viewport-for-bounds", { bounds: { x: 0, y: 0, width: "1" } }),
        ).toBeUndefined();
        expect(
            get("viewport-for-bounds", {
                bounds: { x: 0, y: 0, width: -1, height: 1 },
            }),
        ).toBeUndefined();
        // a padding that is no number is the default's
        expect(get("viewport-for-bounds", { bounds, padding: "wide" })).toEqual(
            sized.engine.get("viewport-for-bounds", { bounds }),
        );
        const empty = mount(flowOf({}), {
            root: { left: 0, top: 0, width: 0, height: 0 },
        });
        expect(
            empty.engine.get("viewport-for-bounds", { bounds }),
        ).toBeUndefined();
    });
});
