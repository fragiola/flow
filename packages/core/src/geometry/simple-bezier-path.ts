// A simple bezier edge: one cubic curve whose control points lie on each end's side axis (the
// line through the end in its side's direction), halfway to where the other end projects on that
// axis. Unlike the bezier it has no least reach: two ends on one line draw a straight curve, and
// an end whose other end is behind it turns back at once. The shape depends only on the ends and
// their sides' axes (a side and its opposite give the same curve).
import type { XY } from "../document/types";
import { formatPoint, sideDirection } from "./path-format";
import type { HandleSide, PathEnds, PathResult } from "./types";

/** Options of {@link simpleBezierPath}: the two ends and their sides. */
export interface SimpleBezierPathOptions extends PathEnds {}

/** The control point of the end at `from` (on a `side`), halfway along its axis to `to`. */
function controlPoint(from: XY, side: HandleSide, to: XY): XY {
    const axis = sideDirection(side);
    // the signed distance from `from` to `to`'s projection on the axis, halved
    const half = ((to.x - from.x) * axis.x + (to.y - from.y) * axis.y) / 2;
    return { x: from.x + axis.x * half, y: from.y + axis.y * half };
}

/**
 * A simple bezier edge's path from `source` to `target`, and its label point (the curve's middle,
 * `t = 0.5`).
 */
export function simpleBezierPath(options: SimpleBezierPathOptions): PathResult {
    const { source, target, sourceSide, targetSide } = options;
    const c1 = controlPoint(source, sourceSide, target);
    const c2 = controlPoint(target, targetSide, source);
    // B(1/2) = (P0 + 3 P1 + 3 P2 + P3) / 8
    const label = {
        x: (source.x + 3 * c1.x + 3 * c2.x + target.x) / 8,
        y: (source.y + 3 * c1.y + 3 * c2.y + target.y) / 8,
    };
    return {
        path: `M${formatPoint(source)} C${formatPoint(c1)} ${formatPoint(c2)} ${formatPoint(target)}`,
        label,
    };
}
