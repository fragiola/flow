// Where a floating edge meets a node: framework-free geometry over a node's box and its shape. A
// rectangle's border is its box; an ellipse's (a circle, an oval) is the ellipse inscribed in its
// box. A floating end lies where the line between the two nodes' centres leaves the node; the
// "simple" end is the middle of the node's side nearest the other node. Either way the end knows
// the side it faces, so a bezier path leaves and enters square.

export interface Point {
    readonly x: number;
    readonly y: number;
}

/** How a node's border is drawn inside its box. */
export type Shape = "rect" | "ellipse";

/** A node as the edge reads it: its box in flow coordinates (top-left corner) and its shape. */
export interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly shape: Shape;
}

export type Side = "top" | "right" | "bottom" | "left";

/** An edge's two ends and the sides they face: what a path helper draws between. */
export interface Ends {
    readonly source: Point;
    readonly sourceSide: Side;
    readonly target: Point;
    readonly targetSide: Side;
}

const SIDES: readonly Side[] = ["top", "right", "bottom", "left"];

export function centerOf(box: Box): Point {
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * Where the line from the box's centre toward `toward` crosses its border: the nearer pair of a
 * rectangle's sides, or the inscribed ellipse; the centre itself when both points are the same.
 */
export function borderPoint(box: Box, toward: Point): Point {
    const center = centerOf(box);
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (dx === 0 && dy === 0) return center;
    const a = box.width / 2;
    const b = box.height / 2;
    // how far along the line (0 the centre, 1 `toward`) the border is met
    const t =
        box.shape === "ellipse"
            ? 1 / Math.hypot(dx / a, dy / b)
            : Math.min(
                  dx === 0 ? Number.POSITIVE_INFINITY : a / Math.abs(dx),
                  dy === 0 ? Number.POSITIVE_INFINITY : b / Math.abs(dy),
              );
    return { x: center.x + dx * t, y: center.y + dy * t };
}

/**
 * The side of the box a point of its border faces: the larger of its offsets from the centre,
 * each measured against half the box (so a wide box's corner reads as its end, not its top).
 */
export function sideAt(box: Box, point: Point): Side {
    const center = centerOf(box);
    const nx = (point.x - center.x) / (box.width / 2);
    const ny = (point.y - center.y) / (box.height / 2);
    if (Math.abs(nx) >= Math.abs(ny)) return nx >= 0 ? "right" : "left";
    return ny >= 0 ? "bottom" : "top";
}

/** The middle of a side of the box (on an ellipse too: its extremes). */
export function sideCenter(box: Box, side: Side): Point {
    const center = centerOf(box);
    switch (side) {
        case "top":
            return { x: center.x, y: box.y };
        case "right":
            return { x: box.x + box.width, y: center.y };
        case "bottom":
            return { x: center.x, y: box.y + box.height };
        case "left":
            return { x: box.x, y: center.y };
    }
}

/** The side whose middle is nearest to `toward` (the first, top, on a tie). */
export function nearestSide(box: Box, toward: Point): Side {
    let best: Side = "top";
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const side of SIDES) {
        const point = sideCenter(box, side);
        const distance = Math.hypot(point.x - toward.x, point.y - toward.y);
        if (distance < bestDistance) {
            best = side;
            bestDistance = distance;
        }
    }
    return best;
}

/** A floating edge's ends: where the line between the centres leaves each node. */
export function floatingEnds(source: Box, target: Box): Ends {
    const from = borderPoint(source, centerOf(target));
    const to = borderPoint(target, centerOf(source));
    return {
        source: from,
        sourceSide: sideAt(source, from),
        target: to,
        targetSide: sideAt(target, to),
    };
}

/** A simple floating edge's ends: each node's side middle nearest the other node's centre. */
export function simpleEnds(source: Box, target: Box): Ends {
    const sourceSide = nearestSide(source, centerOf(target));
    const targetSide = nearestSide(target, centerOf(source));
    return {
        source: sideCenter(source, sourceSide),
        sourceSide,
        target: sideCenter(target, targetSide),
        targetSide,
    };
}
