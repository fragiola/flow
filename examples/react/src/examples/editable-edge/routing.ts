// An orthogonal route around rectangles: framework-free geometry over flow coordinates. The route
// leaves its source end straight out of the side it starts on, by a margin, and enters its target
// end the same way; between those two stubs it searches a coarse grid (A*) whose lines are the
// obstacles' borders inflated by the margin, the stubs' own lines and a frame around everything,
// so every turn sits on a grid line and every run keeps the margin from a node. A turn costs a
// little more than its length, so the route takes few bends. When no way round exists (a stub
// buried in another node, a target walled in), a plain step between the stubs stands in and the
// result says it was not found.

export interface Point {
    readonly x: number;
    readonly y: number;
}

/** An axis-aligned rectangle: its top-left corner and its size. */
export interface Rect {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

export type Side = "top" | "right" | "bottom" | "left";

/** An end of the route: where it is, and the side of its node it leaves or enters by. */
export interface RouteEnd {
    readonly point: Point;
    readonly side: Side;
    /**
     * the box of its node: the stub then reaches the margin past that side of the box, wherever
     * the end sits on it (a handle may stand a little inside or outside the border)
     */
    readonly node?: Rect | undefined;
}

export interface RouteOptions {
    /** how far the route keeps from every obstacle, and the stubs' length (default 20) */
    readonly margin?: number;
    /** what a turn costs on top of the run's length (default 40) */
    readonly bend?: number;
}

export interface Route {
    /** the route's corners between its two ends (the ends themselves left out) */
    readonly points: Point[];
    /** false when no way around was found and a plain step stands in */
    readonly found: boolean;
}

const DIRECTIONS: readonly Point[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
];

const SIDE_DIRECTION: Record<Side, number> = {
    right: 0,
    bottom: 1,
    left: 2,
    top: 3,
};

/** The point a side points to from `point`, `by` away. */
function outOf(point: Point, side: Side, by: number): Point {
    const direction = DIRECTIONS[SIDE_DIRECTION[side]] as Point;
    return { x: point.x + direction.x * by, y: point.y + direction.y * by };
}

/** Where the route leaves (or enters) an end: the margin out of its side, or of its node's. */
function stubOf(end: RouteEnd, margin: number): Point {
    const { point, side, node } = end;
    if (!node) return outOf(point, side, margin);
    switch (side) {
        case "right":
            return { x: node.x + node.width + margin, y: point.y };
        case "left":
            return { x: node.x - margin, y: point.y };
        case "bottom":
            return { x: point.x, y: node.y + node.height + margin };
        case "top":
            return { x: point.x, y: node.y - margin };
    }
}

/** A rectangle grown by `by` on every side. */
export function inflate(rect: Rect, by: number): Rect {
    return {
        x: rect.x - by,
        y: rect.y - by,
        width: rect.width + by * 2,
        height: rect.height + by * 2,
    };
}

const EPSILON = 1e-6;

/** Whether a point is strictly inside a rectangle (its border is outside). */
export function strictlyInside(point: Point, rect: Rect): boolean {
    return (
        point.x > rect.x + EPSILON &&
        point.x < rect.x + rect.width - EPSILON &&
        point.y > rect.y + EPSILON &&
        point.y < rect.y + rect.height - EPSILON
    );
}

/**
 * Whether an axis-aligned segment runs through a rectangle's inside (touching or running along
 * its border does not count).
 */
export function crosses(a: Point, b: Point, rect: Rect): boolean {
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    const overlapsX =
        left === right
            ? left > rect.x + EPSILON && left < rect.x + rect.width - EPSILON
            : left < rect.x + rect.width - EPSILON && right > rect.x + EPSILON;
    const overlapsY =
        top === bottom
            ? top > rect.y + EPSILON && top < rect.y + rect.height - EPSILON
            : top < rect.y + rect.height - EPSILON && bottom > rect.y + EPSILON;
    return overlapsX && overlapsY;
}

/** The points without repeats and without the middle of a straight run (the ends kept). */
export function simplify(points: readonly Point[]): Point[] {
    const unique = points.filter(
        (point, i) =>
            i === 0 ||
            point.x !== (points[i - 1] as Point).x ||
            point.y !== (points[i - 1] as Point).y,
    );
    return unique.filter((point, i) => {
        if (i === 0 || i === unique.length - 1) return true;
        const before = unique[i - 1] as Point;
        const after = unique[i + 1] as Point;
        const cross =
            (point.x - before.x) * (after.y - point.y) -
            (point.y - before.y) * (after.x - point.x);
        return Math.abs(cross) > EPSILON;
    });
}

/** A plain step between two points: across to the middle, along, across again. */
export function stepBetween(from: Point, to: Point): Point[] {
    const middle = (from.x + to.x) / 2;
    return simplify([
        from,
        { x: middle, y: from.y },
        { x: middle, y: to.y },
        to,
    ]);
}

/** The sorted distinct values. */
function lines(values: readonly number[]): number[] {
    return [...new Set(values)].sort((a, b) => a - b);
}

interface State {
    readonly i: number;
    readonly j: number;
    /** the direction it arrived in (an index of DIRECTIONS) */
    readonly direction: number;
}

/**
 * The orthogonal route from `source` to `target` around `obstacles` (every node's box, the two
 * ends' own nodes included), as its corners between the two ends.
 */
export function routeAround(
    source: RouteEnd,
    target: RouteEnd,
    obstacles: readonly Rect[],
    options: RouteOptions = {},
): Route {
    const margin = options.margin ?? 20;
    const bend = options.bend ?? 40;
    const start = stubOf(source, margin);
    const goal = stubOf(target, margin);
    const fallback = (): Route => ({
        points: simplify([
            source.point,
            ...stepBetween(start, goal),
            target.point,
        ]).slice(1, -1),
        found: false,
    });

    const boxes = obstacles.map((rect) => inflate(rect, margin));
    if (
        boxes.some(
            (box) => strictlyInside(start, box) || strictlyInside(goal, box),
        )
    )
        return fallback();

    // the grid: the boxes' borders, the stubs' lines and a frame around them all
    const allX = [
        start.x,
        goal.x,
        ...boxes.flatMap((b) => [b.x, b.x + b.width]),
    ];
    const allY = [
        start.y,
        goal.y,
        ...boxes.flatMap((b) => [b.y, b.y + b.height]),
    ];
    const xs = lines([
        ...allX,
        Math.min(...allX) - margin,
        Math.max(...allX) + margin,
    ]);
    const ys = lines([
        ...allY,
        Math.min(...allY) - margin,
        Math.max(...allY) + margin,
    ]);
    const at = (i: number, j: number): Point => ({
        x: xs[i] as number,
        y: ys[j] as number,
    });
    const free = (a: Point, b: Point) =>
        !boxes.some((box) => crosses(a, b, box));

    const goalI = xs.indexOf(goal.x);
    const goalJ = ys.indexOf(goal.y);
    // the direction the route enters the target in: against its side's
    const entering = (SIDE_DIRECTION[target.side] + 2) % 4;
    const key = (state: State) =>
        (state.j * xs.length + state.i) * 4 + state.direction;
    const heuristic = (i: number, j: number) =>
        Math.abs((xs[i] as number) - goal.x) +
        Math.abs((ys[j] as number) - goal.y);

    const first: State = {
        i: xs.indexOf(start.x),
        j: ys.indexOf(start.y),
        direction: SIDE_DIRECTION[source.side],
    };
    const cost = new Map<number, number>([[key(first), 0]]);
    const previous = new Map<number, State>();
    const open: { state: State; score: number }[] = [
        { state: first, score: heuristic(first.i, first.j) },
    ];
    const done = new Set<number>();

    while (open.length > 0) {
        // the cheapest open state (the grid is small: a scan is enough)
        let best = 0;
        for (let n = 1; n < open.length; n++) {
            if (
                (open[n] as { score: number }).score <
                (open[best] as { score: number }).score
            )
                best = n;
        }
        const { state } = open.splice(best, 1)[0] as { state: State };
        const stateKey = key(state);
        if (done.has(stateKey)) continue;
        done.add(stateKey);
        if (state.i === goalI && state.j === goalJ) {
            const cells: Point[] = [];
            let walk: State | undefined = state;
            while (walk) {
                cells.unshift(at(walk.i, walk.j));
                walk = previous.get(key(walk));
            }
            return {
                points: simplify([source.point, ...cells, target.point]).slice(
                    1,
                    -1,
                ),
                found: true,
            };
        }
        const here = at(state.i, state.j);
        const spent = cost.get(stateKey) as number;
        DIRECTIONS.forEach((step, direction) => {
            // never straight back the way it came
            if (direction === (state.direction + 2) % 4) return;
            const i = state.i + step.x;
            const j = state.j + step.y;
            if (i < 0 || j < 0 || i >= xs.length || j >= ys.length) return;
            const there = at(i, j);
            if (!free(here, there)) return;
            const arrives = i === goalI && j === goalJ;
            const next: State = { i, j, direction };
            const turns =
                (direction !== state.direction ? bend : 0) +
                (arrives && direction !== entering ? bend : 0);
            const total =
                spent +
                Math.abs(there.x - here.x) +
                Math.abs(there.y - here.y) +
                turns;
            const nextKey = key(next);
            if (total >= (cost.get(nextKey) ?? Number.POSITIVE_INFINITY))
                return;
            cost.set(nextKey, total);
            previous.set(nextKey, state);
            open.push({ state: next, score: total + heuristic(i, j) });
        });
    }
    return fallback();
}
