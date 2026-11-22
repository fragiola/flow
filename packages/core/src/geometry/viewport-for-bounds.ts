// The viewport that frames a flow rectangle in a root of a given size: what `fit-view` sets and
// what `engine.get("viewport-for-bounds", …)` answers, as a pure function an app can call too (a
// server render, a thumbnail, a saved view).
import type { Rect, Viewport } from "./types";
import { centeredOn, clampZoom } from "./viewport-math";

/**
 * One side's padding: a number is a share of the root's size along it (its width for the left and
 * right, its height for the top and bottom), a `"<n>px"` string pixels.
 */
export type PaddingValue = number | `${number}px`;

/**
 * The room kept free around framed bounds: one value for every side, or each side's (a side left
 * out keeps none).
 */
export type FitPadding =
    | PaddingValue
    | {
          readonly top?: PaddingValue | undefined;
          readonly right?: PaddingValue | undefined;
          readonly bottom?: PaddingValue | undefined;
          readonly left?: PaddingValue | undefined;
      };

/** Whether a value is one side's padding: a finite number, or a `"<n>px"` string. */
function paddingValue(value: unknown): value is PaddingValue {
    if (typeof value === "number") return Number.isFinite(value);
    return (
        typeof value === "string" &&
        /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?px$/i.test(value.trim())
    );
}

/** Whether a value is a padding {@link viewportForBounds} takes (a side's or every side's). */
export function isFitPadding(value: unknown): value is FitPadding {
    if (paddingValue(value)) return true;
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false;
    }
    const record = value as Record<string, unknown>;
    return (
        Object.keys(record).every((key) =>
            ["top", "right", "bottom", "left"].includes(key),
        ) &&
        Object.values(record).every(
            (side) => side === undefined || paddingValue(side),
        )
    );
}

/** One side's padding in pixels, along a dimension of `length` pixels. */
function pixels(value: PaddingValue | undefined, length: number): number {
    if (value === undefined) return 0;
    return typeof value === "number"
        ? value * length
        : Number.parseFloat(value);
}

/** Options of {@link viewportForBounds}. */
export interface ViewportForBoundsOptions {
    /**
     * the room kept free on every side (a number: a share of the root's size), or each side's
     * (`{ top, right, bottom, left }`, a `"<n>px"` string in pixels); default 0.1
     */
    readonly padding?: FitPadding | undefined;
    /** the least zoom it may pick; default 0.5 */
    readonly minZoom?: number | undefined;
    /** the greatest zoom it may pick; default 2 */
    readonly maxZoom?: number | undefined;
}

/**
 * The viewport that shows `bounds` (flow coordinates) whole and centred in a root of `width` ×
 * `height` pixels, `padding` kept free on every side (or each side's: the bounds are centred in
 * what is left), its zoom between `minZoom` and `maxZoom` (a rectangle without a size gets the
 * greatest zoom, centred on it; a `maxZoom` below `minZoom` wins).
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
    if (typeof padding !== "number") {
        return framedIn(bounds, width, height, padding, minZoom, maxZoom);
    }
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

/** {@link viewportForBounds} with each side's padding: the bounds centred in the room left. */
function framedIn(
    bounds: Rect,
    width: number,
    height: number,
    padding: Exclude<FitPadding, number>,
    minZoom: number,
    maxZoom: number,
): Viewport {
    const sides =
        typeof padding === "string"
            ? { top: padding, right: padding, bottom: padding, left: padding }
            : padding;
    const top = pixels(sides.top, height);
    const right = pixels(sides.right, width);
    const bottom = pixels(sides.bottom, height);
    const left = pixels(sides.left, width);
    const roomX = Math.max(0, width - left - right);
    const roomY = Math.max(0, height - top - bottom);
    const along = (room: number, flow: number) =>
        flow > 0 ? room / flow : Number.POSITIVE_INFINITY;
    const fitting = Math.min(
        along(roomX, bounds.width),
        along(roomY, bounds.height),
    );
    const zoom = clampZoom(
        Number.isFinite(fitting) ? fitting : maxZoom,
        minZoom,
        maxZoom,
    );
    return {
        x: left + roomX / 2 - (bounds.x + bounds.width / 2) * zoom,
        y: top + roomY / 2 - (bounds.y + bounds.height / 2) * zoom,
        zoom,
    };
}
