// The viewport that frames a flow rectangle in a root of a given size: what `fit-view` sets and
// what `engine.get("viewport-for-bounds", …)` answers, as a pure function an app can call too (a
// server render, a thumbnail, a saved view).
import type { Rect, Viewport } from "./types";
import { centeredOn, clampZoom } from "./viewport-math";

/** Options of {@link viewportForBounds}. */
export interface ViewportForBoundsOptions {
    /** the share of the root's size kept free on every side; default 0.1 */
    readonly padding?: number | undefined;
    /** the least zoom it may pick; default 0.5 */
    readonly minZoom?: number | undefined;
    /** the greatest zoom it may pick; default 2 */
    readonly maxZoom?: number | undefined;
}

/**
 * The viewport that shows `bounds` (flow coordinates) whole and centred in a root of `width` ×
 * `height` pixels, `padding` kept free on every side, its zoom between `minZoom` and `maxZoom` (a
 * rectangle without a size gets the greatest zoom, centred on it; a `maxZoom` below `minZoom`
 * wins).
 */
export function viewportForBounds(
    bounds: Rect,
    width: number,
    height: number,
    options: ViewportForBoundsOptions = {},
): Viewport {
    const padding = options.padding ?? 0.1;
    const minZoom = options.minZoom ?? 0.5;
    const maxZoom = options.maxZoom ?? 2;
    // the share of each dimension the bounds may take
    const room = Math.max(0, 1 - 2 * padding);
    const along = (screen: number, flow: number) =>
        flow > 0 ? (screen * room) / flow : Number.POSITIVE_INFINITY;
    const fitting = Math.min(
        along(width, bounds.width),
        along(height, bounds.height),
    );
    const zoom = clampZoom(
        Number.isFinite(fitting) ? fitting : maxZoom,
        minZoom,
        maxZoom,
    );
    return centeredOn(
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        zoom,
        { width, height },
    );
}
