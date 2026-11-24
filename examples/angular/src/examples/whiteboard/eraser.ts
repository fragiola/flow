// The eraser: the pointer's way, run by run (each move a segment), against the nodes' boxes and
// the edges' lines. A run hits a box when it ends inside it or passes within `reach` of its
// border, and an edge when it passes within `reach` of its line (a straight edge: one segment).

import type { Bounds, Point } from "./stroke";

/** A straight line between two points. */
export interface Segment {
    readonly a: Point;
    readonly b: Point;
}

/** The distance from a point to a segment. */
export function distanceToSegment(point: Point, { a, b }: Segment): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    const t =
        length === 0
            ? 0
            : Math.max(
                  0,
                  Math.min(
                      1,
                      ((point.x - a.x) * dx + (point.y - a.y) * dy) / length,
                  ),
              );
    return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

/** Which side of the line through `a` and `b` a point is on: -1, 0 (on it) or 1. */
const side = (a: Point, b: Point, point: Point) =>
    Math.sign((b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x));

/** The shortest distance between two segments (0 when they cross). */
export function segmentDistance(first: Segment, second: Segment): number {
    const crossing =
        side(second.a, second.b, first.a) * side(second.a, second.b, first.b) <
            0 &&
        side(first.a, first.b, second.a) * side(first.a, first.b, second.b) < 0;
    if (crossing) return 0;
    return Math.min(
        distanceToSegment(first.a, second),
        distanceToSegment(first.b, second),
        distanceToSegment(second.a, first),
        distanceToSegment(second.b, first),
    );
}

const inside = (point: Point, box: Bounds) =>
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height;

/** Whether a run touches a box: an end inside it, or within `reach` of one of its sides. */
export function segmentHitsBox(run: Segment, box: Bounds, reach = 0): boolean {
    if (inside(run.a, box) || inside(run.b, box)) return true;
    const right = box.x + box.width;
    const bottom = box.y + box.height;
    const corners = [
        { x: box.x, y: box.y },
        { x: right, y: box.y },
        { x: right, y: bottom },
        { x: box.x, y: bottom },
    ];
    return corners.some(
        (corner, index) =>
            segmentDistance(run, {
                a: corner,
                b: corners[(index + 1) % 4] as Point,
            }) <= reach,
    );
}

/** What one run of the eraser wipes: the boxes it touches and the lines it passes by. */
export function wiped(
    run: Segment,
    targets: {
        readonly nodes: readonly {
            readonly id: string;
            readonly box: Bounds;
        }[];
        readonly edges: readonly {
            readonly id: string;
            readonly line: Segment;
        }[];
    },
    reach = 6,
): { nodeIds: string[]; edgeIds: string[] } {
    return {
        nodeIds: targets.nodes
            .filter(({ box }) => segmentHitsBox(run, box, reach))
            .map(({ id }) => id),
        edgeIds: targets.edges
            .filter(({ line }) => segmentDistance(run, line) <= reach)
            .map(({ id }) => id),
    };
}
