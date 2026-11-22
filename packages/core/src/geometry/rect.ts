// Rectangle helpers: bounds, overlap and containment, in any one coordinate space.
import type { Rect } from "./types";

/** The smallest rectangle holding every rectangle given (`undefined` for none). */
export function boundsOf(rects: Iterable<Rect>): Rect | undefined {
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const rect of rects) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
    }
    return minX === Number.POSITIVE_INFINITY
        ? undefined
        : { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Whether two rectangles share some area, or touch (a zero-size rectangle inside counts). */
export function overlaps(a: Rect, b: Rect): boolean {
    return (
        a.x <= b.x + b.width &&
        b.x <= a.x + a.width &&
        a.y <= b.y + b.height &&
        b.y <= a.y + a.height
    );
}

/**
 * Whether two rectangles share some area: touching sides do not, a rectangle of no size strictly
 * inside the other does.
 */
export function sharesArea(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.width &&
        b.x < a.x + a.width &&
        a.y < b.y + b.height &&
        b.y < a.y + a.height
    );
}

/** Whether `inner` lies wholly inside `outer`. */
export function contains(outer: Rect, inner: Rect): boolean {
    return (
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        inner.x + inner.width <= outer.x + outer.width &&
        inner.y + inner.height <= outer.y + outer.height
    );
}

/** A rectangle from two corners in any order. */
export function rectFromCorners(
    a: { x: number; y: number },
    b: { x: number; y: number },
): Rect {
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
    };
}

/**
 * A node's box from its position and its size: the position stands at `origin` of the box (shares
 * of its size, `{ x: 0, y: 0 }` its top-left corner, `{ x: 0.5, y: 0.5 }` its centre). Every box
 * the engine derives from a node goes through it (`nodeOrigin`).
 */
export function nodeBox(
    position: { x: number; y: number },
    size: { width: number; height: number },
    origin: { x: number; y: number },
): Rect {
    return {
        x: position.x - origin.x * size.width,
        y: position.y - origin.y * size.height,
        width: size.width,
        height: size.height,
    };
}

/** The intersection of rectangles (`undefined` for none given); an empty one keeps its corner. */
export function intersectionOf(rects: Iterable<Rect>): Rect | undefined {
    let left = Number.NEGATIVE_INFINITY;
    let top = Number.NEGATIVE_INFINITY;
    let right = Number.POSITIVE_INFINITY;
    let bottom = Number.POSITIVE_INFINITY;
    let found = false;
    for (const rect of rects) {
        found = true;
        left = Math.max(left, rect.x);
        top = Math.max(top, rect.y);
        right = Math.min(right, rect.x + rect.width);
        bottom = Math.min(bottom, rect.y + rect.height);
    }
    return found
        ? {
              x: left,
              y: top,
              width: Math.max(0, right - left),
              height: Math.max(0, bottom - top),
          }
        : undefined;
}

/**
 * A box's top-left corner moved so the box stays inside `bounds` (as far as it fits: a box larger
 * than the bounds keeps to their top-left corner).
 */
export function cornerInside(
    corner: { x: number; y: number },
    size: { width: number; height: number },
    bounds: Rect,
): { x: number; y: number } {
    const keep = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(value, max));
    return {
        x: keep(corner.x, bounds.x, bounds.x + bounds.width - size.width),
        y: keep(corner.y, bounds.y, bounds.y + bounds.height - size.height),
    };
}
