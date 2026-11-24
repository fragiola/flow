// The intersections example's edge test, free of any framework: whether an edge's path crosses a
// node's box. The path is the SVG path data the engine gives (`edge-path-by`'s `path`): it is read
// into a polyline (straight lines as they are, curves sampled), and each of its segments is
// clipped against the box. A path that only runs inside the box crosses it too.

/** A point in flow coordinates. */
export interface Point {
    readonly x: number;
    readonly y: number;
}

/** A box in flow coordinates (a node's `node-rect-by`). */
export interface Box {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** How many points a curve is sampled into (its start left out). */
const SAMPLES = 16;

const TOKEN = /[MLHVCSQTZmlhvcsqtz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;

/** A cubic Bézier's point at `t`. */
function cubic(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    return {
        x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
        y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    };
}

/** A quadratic Bézier's point at `t`. */
function quadratic(p0: Point, p1: Point, p2: Point, t: number): Point {
    const u = 1 - t;
    return {
        x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
        y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    };
}

/**
 * SVG path data as a polyline: `M`, `L`, `H`, `V`, `C`, `S`, `Q`, `T` and `Z`, absolute or
 * relative (what the edge paths are made of); curves are sampled, arcs are not read. A new `M`
 * starts a new run: the runs are returned one after another, each a list of points.
 */
export function pathRuns(d: string, samples = SAMPLES): Point[][] {
    const tokens = d.match(TOKEN) ?? [];
    const runs: Point[][] = [];
    let run: Point[] = [];
    let current: Point = { x: 0, y: 0 };
    let start: Point = current;
    // the last curve's second control point, for `S` and `T`
    let control: Point | undefined;
    let command = "";
    let index = 0;
    const number = () => Number(tokens[index++]);
    const isNumber = (token: string | undefined) =>
        token !== undefined && !/^[a-z]$/i.test(token);

    const sample = (at: (t: number) => Point) => {
        for (let step = 1; step <= samples; step++)
            run.push(at(step / samples));
    };

    while (index < tokens.length) {
        const token = tokens[index] as string;
        if (!isNumber(token)) {
            command = token;
            index++;
            if (command === "Z" || command === "z") {
                run.push(start);
                current = start;
                control = undefined;
                continue;
            }
        } else if (command === "") {
            // numbers before any command: not path data
            break;
        }
        const relative = command === command.toLowerCase();
        const base = relative ? current : { x: 0, y: 0 };
        const point = (): Point => {
            const x = number();
            const y = number();
            return { x: base.x + x, y: base.y + y };
        };
        switch (command.toUpperCase()) {
            case "M": {
                if (run.length > 1) runs.push(run);
                current = point();
                start = current;
                run = [current];
                control = undefined;
                // further pairs after a move are lines
                command = relative ? "l" : "L";
                break;
            }
            case "L": {
                current = point();
                run.push(current);
                control = undefined;
                break;
            }
            case "H": {
                current = { x: base.x + number(), y: current.y };
                run.push(current);
                control = undefined;
                break;
            }
            case "V": {
                current = {
                    x: current.x,
                    y: (relative ? current.y : 0) + number(),
                };
                run.push(current);
                control = undefined;
                break;
            }
            case "C":
            case "S": {
                const from = current;
                const first =
                    command.toUpperCase() === "C"
                        ? point()
                        : control
                          ? {
                                x: 2 * from.x - control.x,
                                y: 2 * from.y - control.y,
                            }
                          : from;
                const second = point();
                const to = point();
                sample((t) => cubic(from, first, second, to, t));
                current = to;
                control = second;
                break;
            }
            case "Q":
            case "T": {
                const from = current;
                const middle =
                    command.toUpperCase() === "Q"
                        ? point()
                        : control
                          ? {
                                x: 2 * from.x - control.x,
                                y: 2 * from.y - control.y,
                            }
                          : from;
                const to = point();
                sample((t) => quadratic(from, middle, to, t));
                current = to;
                control = middle;
                break;
            }
            default:
                // an arc or anything else: stop reading, keep what was read
                index = tokens.length;
        }
        if (Number.isNaN(current.x) || Number.isNaN(current.y)) {
            run.pop();
            break;
        }
    }
    if (run.length > 1) runs.push(run);
    return runs;
}

/** Whether a point lies in the box (its border included). */
export function insideBox(point: Point, box: Box): boolean {
    return (
        point.x >= box.x &&
        point.x <= box.x + box.width &&
        point.y >= box.y &&
        point.y <= box.y + box.height
    );
}

/**
 * Whether the segment from `a` to `b` has a point in the box (Liang–Barsky clipping: the part of
 * the segment between the box's four sides is not empty).
 */
export function segmentCrossesBox(a: Point, b: Point, box: Box): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let enter = 0;
    let leave = 1;
    const sides: readonly (readonly [number, number])[] = [
        [-dx, a.x - box.x],
        [dx, box.x + box.width - a.x],
        [-dy, a.y - box.y],
        [dy, box.y + box.height - a.y],
    ];
    for (const [p, q] of sides) {
        if (p === 0) {
            // parallel to that side: outside it altogether, or no limit
            if (q < 0) return false;
            continue;
        }
        const t = q / p;
        if (p < 0) enter = Math.max(enter, t);
        else leave = Math.min(leave, t);
        if (enter > leave) return false;
    }
    return true;
}

/** Whether the path (SVG path data) crosses the box, or runs inside it. */
export function pathCrossesBox(d: string, box: Box): boolean {
    for (const run of pathRuns(d)) {
        for (let i = 1; i < run.length; i++) {
            if (segmentCrossesBox(run[i - 1] as Point, run[i] as Point, box)) {
                return true;
            }
        }
    }
    return false;
}
