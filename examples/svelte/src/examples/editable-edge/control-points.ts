// An editable edge's control points: framework-free geometry over flow coordinates. The edge runs
// from its source end through its points, in order, to its target end; each corner is rounded by
// a radius (never more than half of either run it joins), so a route of right angles reads as a
// smooth step and a free bend as a soft one. A new point goes into the run nearest to it.

export interface Point {
    readonly x: number;
    readonly y: number;
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** A number as path data writes it: at most two decimals, never `-0`. */
function format(value: number): string {
    const rounded = Math.round(value * 100) / 100;
    return String(Object.is(rounded, -0) ? 0 : rounded);
}

const pair = (point: Point) => `${format(point.x)},${format(point.y)}`;

/** Path data through the points, each corner rounded by `radius`. */
export function pathThrough(points: readonly Point[], radius = 0): string {
    const first = points[0];
    if (!first) return "";
    const parts = [`M${pair(first)}`];
    for (let i = 1; i < points.length - 1; i++) {
        const before = points[i - 1] as Point;
        const corner = points[i] as Point;
        const after = points[i + 1] as Point;
        const into = distance(before, corner);
        const out = distance(corner, after);
        const r = Math.min(radius, into / 2, out / 2);
        if (r <= 0) {
            parts.push(`L${pair(corner)}`);
            continue;
        }
        const enter = {
            x: corner.x + ((before.x - corner.x) / into) * r,
            y: corner.y + ((before.y - corner.y) / into) * r,
        };
        const leave = {
            x: corner.x + ((after.x - corner.x) / out) * r,
            y: corner.y + ((after.y - corner.y) / out) * r,
        };
        parts.push(`L${pair(enter)}`, `Q${pair(corner)} ${pair(leave)}`);
    }
    const last = points.at(-1) as Point;
    if (points.length > 1) parts.push(`L${pair(last)}`);
    return parts.join(" ");
}

/** How far a point is from the segment between `a` and `b`. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = dx * dx + dy * dy;
    if (length === 0) return distance(point, a);
    const t = Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length),
    );
    return distance(point, { x: a.x + dx * t, y: a.y + dy * t });
}

/**
 * The control points with `point` added in the run nearest to it, between the edge's `source`
 * and `target` ends.
 */
export function insertPoint(
    source: Point,
    target: Point,
    points: readonly Point[],
    point: Point,
): Point[] {
    const line = [source, ...points, target];
    let nearest = 0;
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < line.length - 1; i++) {
        const d = distanceToSegment(
            point,
            line[i] as Point,
            line[i + 1] as Point,
        );
        if (d < best) {
            best = d;
            nearest = i;
        }
    }
    return [...points.slice(0, nearest), point, ...points.slice(nearest)];
}

/** The control points with the one at `index` moved to `point`. */
export function movePoint(
    points: readonly Point[],
    index: number,
    point: Point,
): Point[] {
    return points.map((each, i) => (i === index ? point : each));
}

/** The control points without the one at `index`. */
export function removePoint(points: readonly Point[], index: number): Point[] {
    return points.filter((_, i) => i !== index);
}
