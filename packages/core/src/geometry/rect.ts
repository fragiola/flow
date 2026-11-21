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
