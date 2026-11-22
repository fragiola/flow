// Step and smooth step edges: an orthogonal route (horizontal and vertical segments only) from the
// source to the target, leaving and entering each handle along its side. A smooth step rounds each
// corner with a quadratic curve of `borderRadius`; a step is a smooth step with square corners.
//
// The route: each end first stands out from its node by `offset` along its side. Then
// - two ends on parallel axes facing each other (right to left), the target ahead: one turn halfway
//   between them (at `stepPosition` of the way, or at `centerX` / `centerY`);
// - facing each other, the target behind: out by `offset`, across halfway (the same options), and
//   back in;
// - on the same side (right and right): out to the farther of the two, across, and in;
// - on perpendicular axes: one corner where the two lines meet when both ends reach it going
//   forward, otherwise out from both ends by `offset` and joined with one more corner.
// The label goes halfway along the route's length.
import type { XY } from "../document/types";
import { formatPoint, sideDirection } from "./path-format";
import type { PathEnds, PathResult } from "./types";

/** Where the turn between two ends facing each other goes (`smoothStepPath`, `stepPath`). */
export interface StepTurnOptions {
    /**
     * where the turn sits between the source (0) and the target (1), along the ends' axis (across
     * it when the target is behind), counted from the points `offset` out from each end so that
     * 0 and 1 keep the stand-out; default 0.5 (also for a value that is not a finite number)
     */
    readonly stepPosition?: number | undefined;
    /** the turn's x (flow units) when it runs vertically, over `stepPosition` (when finite) */
    readonly centerX?: number | undefined;
    /** the turn's y (flow units) when it runs horizontally, over `stepPosition` (when finite) */
    readonly centerY?: number | undefined;
}

/** Options of {@link smoothStepPath}. */
export interface SmoothStepPathOptions extends PathEnds, StepTurnOptions {
    /** the radius of each rounded corner, in flow units; default 5 */
    readonly borderRadius?: number | undefined;
    /** how far each end stands out from its node before the route turns, in flow units; default 20 */
    readonly offset?: number | undefined;
}

/** Options of {@link stepPath}. */
export interface StepPathOptions extends PathEnds, StepTurnOptions {
    /** how far each end stands out from its node before the route turns, in flow units; default 20 */
    readonly offset?: number | undefined;
}

/** The value `share` of the way from `from` to `to` (exactly the middle at 0.5). */
function between(from: number, to: number, share: number): number {
    return share === 0.5 ? (from + to) / 2 : from + (to - from) * share;
}

/** A finite number as given; anything else (none, NaN, an infinity) as `fallback`. */
function finiteOr<T>(value: number | undefined, fallback: T): number | T {
    return typeof value === "number" && Number.isFinite(value)
        ? value
        : fallback;
}

function plus(point: XY, direction: XY, distance: number): XY {
    return {
        x: point.x + direction.x * distance,
        y: point.y + direction.y * distance,
    };
}

function dot(a: XY, b: XY): number {
    return a.x * b.x + a.y * b.y;
}

function minus(a: XY, b: XY): XY {
    return { x: a.x - b.x, y: a.y - b.y };
}

function distance(a: XY, b: XY): number {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The corners of the orthogonal route between two ends, both ends included. */
export function orthogonalRoute(
    ends: PathEnds,
    offset: number,
    turn: StepTurnOptions = {},
): XY[] {
    const { source, target } = ends;
    const share = Math.min(Math.max(finiteOr(turn.stepPosition, 0.5), 0), 1);
    const centerX = finiteOr(turn.centerX, undefined);
    const centerY = finiteOr(turn.centerY, undefined);
    const a = sideDirection(ends.sourceSide);
    const b = sideDirection(ends.targetSide);
    const out = plus(source, a, offset);
    const into = plus(target, b, offset);
    const sourceHorizontal = a.x !== 0;
    let middle: XY[];
    if (sourceHorizontal === (b.x !== 0)) {
        const horizontal = sourceHorizontal;
        const along = (p: XY) => (horizontal ? p.x : p.y);
        const across = (p: XY) => (horizontal ? p.y : p.x);
        const at = (alongValue: number, acrossValue: number): XY =>
            horizontal
                ? { x: alongValue, y: acrossValue }
                : { x: acrossValue, y: alongValue };
        const sign = horizontal ? a.x : a.y;
        const targetSign = horizontal ? b.x : b.y;
        if (sign === targetSign) {
            // the same side: out to the farther end, across, in
            const reach =
                sign > 0
                    ? Math.max(along(out), along(into))
                    : Math.min(along(out), along(into));
            middle = [at(reach, across(source)), at(reach, across(target))];
        } else if ((along(target) - along(source)) * sign >= 0) {
            // facing each other, the target ahead: turn halfway (or where asked), the share taken
            // between the stood-out points so that a turn near an end keeps its `offset` (halfway
            // between the handles is the same point)
            const half =
                (horizontal ? centerX : centerY) ??
                (share === 0.5
                    ? between(along(source), along(target), share)
                    : between(along(out), along(into), share));
            middle = [at(half, across(source)), at(half, across(target))];
        } else {
            // facing each other, the target behind: out, across halfway (or where asked), back in
            const half =
                (horizontal ? centerY : centerX) ??
                between(across(out), across(into), share);
            middle = [out, at(along(out), half), at(along(into), half), into];
        }
    } else {
        const corner = sourceHorizontal
            ? { x: target.x, y: source.y }
            : { x: source.x, y: target.y };
        if (
            dot(minus(corner, source), a) >= 0 &&
            dot(minus(target, corner), b) <= 0
        ) {
            middle = [corner];
        } else {
            const ahead = dot(minus(into, out), a) >= 0;
            const turn =
                ahead === sourceHorizontal
                    ? { x: into.x, y: out.y }
                    : { x: out.x, y: into.y };
            middle = [out, turn, into];
        }
    }
    return simplified([source, ...middle, target]);
}

/** A route without repeated points, nor corners that do not turn (three points on one line). */
function simplified(points: XY[]): XY[] {
    const unique = points.filter(
        (point, i) => i === 0 || distance(point, points[i - 1] as XY) > 1e-9,
    );
    return unique.filter((point, i) => {
        const before = unique[i - 1];
        const after = unique[i + 1];
        if (!before || !after) return true;
        const cross =
            (point.x - before.x) * (after.y - point.y) -
            (point.y - before.y) * (after.x - point.x);
        // a straight run is dropped; a turn back on itself is kept (it is a corner of the route)
        return (
            Math.abs(cross) > 1e-9 ||
            dot(minus(point, before), minus(after, point)) < 0
        );
    });
}

/** The point halfway along a polyline's length. */
export function halfwayAlong(points: readonly XY[]): XY {
    const first = points[0] ?? { x: 0, y: 0 };
    const lengths = points
        .slice(1)
        .map((point, i) => distance(points[i] as XY, point));
    let remaining = lengths.reduce((sum, length) => sum + length, 0) / 2;
    for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i] as number;
        const from = points[i] as XY;
        const to = points[i + 1] as XY;
        if (remaining <= length && length > 0) {
            const t = remaining / length;
            return {
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t,
            };
        }
        remaining -= length;
    }
    return points.at(-1) ?? first;
}

/** Path data through the route's corners, each rounded by `radius` (at most half its segments). */
export function roundedPath(points: readonly XY[], radius: number): string {
    const first = points[0];
    if (!first) return "";
    const parts = [`M${formatPoint(first)}`];
    for (let i = 1; i < points.length - 1; i++) {
        const before = points[i - 1] as XY;
        const corner = points[i] as XY;
        const after = points[i + 1] as XY;
        const r = Math.min(
            radius,
            distance(before, corner) / 2,
            distance(corner, after) / 2,
        );
        if (r <= 0) {
            parts.push(`L${formatPoint(corner)}`);
            continue;
        }
        const inLength = distance(before, corner);
        const outLength = distance(corner, after);
        const start = {
            x: corner.x - ((corner.x - before.x) / inLength) * r,
            y: corner.y - ((corner.y - before.y) / inLength) * r,
        };
        const end = {
            x: corner.x + ((after.x - corner.x) / outLength) * r,
            y: corner.y + ((after.y - corner.y) / outLength) * r,
        };
        parts.push(
            `L${formatPoint(start)}`,
            `Q${formatPoint(corner)} ${formatPoint(end)}`,
        );
    }
    const last = points.at(-1);
    if (last && points.length > 1) parts.push(`L${formatPoint(last)}`);
    return parts.join(" ");
}

/** A smooth step edge's path (orthogonal, rounded corners) and its label point. */
export function smoothStepPath(options: SmoothStepPathOptions): PathResult {
    const route = orthogonalRoute(options, options.offset ?? 20, options);
    return {
        path: roundedPath(route, options.borderRadius ?? 5),
        label: halfwayAlong(route),
    };
}

/** A step edge's path (orthogonal, square corners) and its label point. */
export function stepPath(options: StepPathOptions): PathResult {
    return smoothStepPath({ ...options, borderRadius: 0 });
}
