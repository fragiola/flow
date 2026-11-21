// The viewport's math (D4): converting points between the screen and the flow, zooming around a
// point, fitting bounds, and keeping the view inside a translate extent. Screen points here are
// relative to the root's top-left corner, in pixels.
import type { XY } from "../document/types";
import type { Rect, Viewport } from "./types";

/** The size of the root, in pixels. */
export interface Size {
    readonly width: number;
    readonly height: number;
}

/** A number without the sign of a zero (`-0` is `0`). */
function unsigned(value: number): number {
    return value + 0;
}

/** A zoom kept between `min` and `max`. */
export function clampZoom(zoom: number, min: number, max: number): number {
    return Math.min(Math.max(zoom, min), max);
}

/** A point on the screen (relative to the root) as a flow point. */
export function toFlow(viewport: Viewport, point: XY): XY {
    return {
        x: (point.x - viewport.x) / viewport.zoom,
        y: (point.y - viewport.y) / viewport.zoom,
    };
}

/** A flow point as a point on the screen (relative to the root). */
export function toScreen(viewport: Viewport, point: XY): XY {
    return {
        x: point.x * viewport.zoom + viewport.x,
        y: point.y * viewport.zoom + viewport.y,
    };
}

/** The viewport at `zoom` that keeps the flow point under the screen point `around` where it is. */
export function zoomAround(
    viewport: Viewport,
    zoom: number,
    around: XY,
): Viewport {
    const anchor = toFlow(viewport, around);
    return {
        x: around.x - anchor.x * zoom,
        y: around.y - anchor.y * zoom,
        zoom,
    };
}

/** The flow rectangle the root shows. */
export function viewRect(viewport: Viewport, size: Size): Rect {
    return {
        x: unsigned(-viewport.x / viewport.zoom),
        y: unsigned(-viewport.y / viewport.zoom),
        width: size.width / viewport.zoom,
        height: size.height / viewport.zoom,
    };
}

/** The viewport that centres the flow point `center` in the root at `zoom`. */
export function centeredOn(center: XY, zoom: number, size: Size): Viewport {
    return {
        x: size.width / 2 - center.x * zoom,
        y: size.height / 2 - center.y * zoom,
        zoom,
    };
}

/**
 * The viewport that shows `bounds` whole and centred, `padding` (a share of the root's size) kept
 * free on every side, its zoom between `minZoom` and `maxZoom`.
 */
export function fitBounds(
    bounds: Rect,
    size: Size,
    padding: number,
    minZoom: number,
    maxZoom: number,
): Viewport {
    const room = Math.max(0, 1 - 2 * padding);
    const zoomX =
        bounds.width > 0
            ? (size.width * room) / bounds.width
            : Number.POSITIVE_INFINITY;
    const zoomY =
        bounds.height > 0
            ? (size.height * room) / bounds.height
            : Number.POSITIVE_INFINITY;
    const fitting = Math.min(zoomX, zoomY);
    const zoom = clampZoom(
        Number.isFinite(fitting) ? fitting : maxZoom,
        minZoom,
        maxZoom,
    );
    return centeredOn(
        { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        zoom,
        size,
    );
}

/**
 * A viewport moved as little as it takes for the root to show only the flow inside `extent`: an
 * extent smaller than the view is centred in it.
 */
export function keptInExtent(
    viewport: Viewport,
    size: Size,
    extent: Rect,
): Viewport {
    const { zoom } = viewport;
    const axis = (
        offset: number,
        start: number,
        length: number,
        room: number,
    ) => {
        const scaled = length * zoom;
        if (scaled <= room) {
            return unsigned((room - scaled) / 2 - start * zoom);
        }
        // the extent's start may not come right of the root's start, nor its end left of its end
        return unsigned(
            Math.min(
                -start * zoom,
                Math.max(room - (start + length) * zoom, offset),
            ),
        );
    };
    return {
        x: axis(viewport.x, extent.x, extent.width, size.width),
        y: axis(viewport.y, extent.y, extent.height, size.height),
        zoom,
    };
}
