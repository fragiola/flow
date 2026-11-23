// A freehand stroke: the pointer's points, thinned while they come, smoothed when the stroke ends
// (Chaikin's corner cutting: each corner replaced by two points a quarter of the way along its
// sides), and saved as a node of its own: its position the stroke's top-left corner (less a
// margin for the line's width), its size the stroke's box, its path relative to that corner.

export interface Point {
    readonly x: number;
    readonly y: number;
}

/** A box: its top-left corner and its size. */
export interface Bounds {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** A stroke saved as a node: where it goes, its size, and its path inside it. */
export interface Stroke {
    readonly position: Point;
    readonly width: number;
    readonly height: number;
    readonly d: string;
}

/** `points` with `point` added, unless it is closer than `spacing` to the last one. */
export function addPoint(
    points: readonly Point[],
    point: Point,
    spacing = 2,
): Point[] {
    const last = points.at(-1);
    if (last && Math.hypot(point.x - last.x, point.y - last.y) < spacing) {
        return [...points];
    }
    return [...points, point];
}

/** The points smoothed by Chaikin's corner cutting, `iterations` times; the ends stay. */
export function smooth(points: readonly Point[], iterations = 2): Point[] {
    let current = [...points];
    for (let round = 0; round < iterations && current.length > 2; round++) {
        const next: Point[] = [current[0] as Point];
        for (let index = 0; index < current.length - 1; index++) {
            const a = current[index] as Point;
            const b = current[index + 1] as Point;
            next.push(
                { x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y },
                { x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y },
            );
        }
        next.push(current.at(-1) as Point);
        current = next;
    }
    return current;
}

/** The smallest box around the points (none without a point). */
export function boundsOf(points: readonly Point[]): Bounds | undefined {
    if (points.length === 0) return undefined;
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return {
        x,
        y,
        width: Math.max(...xs) - x,
        height: Math.max(...ys) - y,
    };
}

const round = (value: number) => Math.round(value * 10) / 10;

/** An SVG path through the points, as straight runs, shifted so that `origin` is 0,0. */
export function pathOf(
    points: readonly Point[],
    origin: Point = { x: 0, y: 0 },
): string {
    return points
        .map(
            (point, index) =>
                `${index === 0 ? "M" : "L"}${round(point.x - origin.x)},${round(point.y - origin.y)}`,
        )
        .join(" ");
}

/**
 * The stroke through `points` (flow coordinates) as a node: smoothed, its box grown by `margin` on
 * every side (half the line's width, so a straight line has a height), its path relative to the
 * box's corner. None for fewer than two points.
 */
export function strokeOf(
    points: readonly Point[],
    margin = 4,
    iterations = 2,
): Stroke | undefined {
    if (points.length < 2) return undefined;
    const smoothed = smooth(points, iterations);
    const box = boundsOf(smoothed) as Bounds;
    const position = { x: box.x - margin, y: box.y - margin };
    return {
        position,
        width: box.width + margin * 2,
        height: box.height + margin * 2,
        d: pathOf(smoothed, position),
    };
}
