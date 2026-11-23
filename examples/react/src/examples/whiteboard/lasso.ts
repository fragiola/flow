// The lasso: a free shape the pointer draws, closed from its last point back to its first. A node
// is inside when its whole box is: its four corners inside the shape (the even-odd rule: a ray
// from the point crosses the shape's sides an odd number of times).

import type { Bounds, Point } from "./stroke";

/** Whether a point is inside the polygon (closed from its last point to its first). */
export function pointInPolygon(
    point: Point,
    polygon: readonly Point[],
): boolean {
    let inside = false;
    for (
        let index = 0, previous = polygon.length - 1;
        index < polygon.length;
        previous = index++
    ) {
        const a = polygon[index] as Point;
        const b = polygon[previous] as Point;
        const crosses =
            a.y > point.y !== b.y > point.y &&
            point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
        if (crosses) inside = !inside;
    }
    return inside;
}

/** Whether a box is wholly inside the polygon: its four corners are (three points at least). */
export function boxInPolygon(box: Bounds, polygon: readonly Point[]): boolean {
    if (polygon.length < 3) return false;
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    return [
        { x: box.x, y: box.y },
        { x: right, y: box.y },
        { x: right, y: bottom },
        { x: box.x, y: bottom },
    ].every((corner) => pointInPolygon(corner, polygon));
}

/** The ids of the boxes wholly inside the lasso, in their order. */
export function insideLasso(
    boxes: readonly { readonly id: string; readonly box: Bounds }[],
    lasso: readonly Point[],
): string[] {
    return boxes
        .filter(({ box }) => boxInPolygon(box, lasso))
        .map(({ id }) => id);
}
