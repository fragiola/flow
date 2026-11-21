// A bezier edge: one cubic curve whose control points stand out from each end in the direction of
// its side, so the edge leaves and enters its handles square. How far a control point stands out
// is a share (`curvature`) of how far the other end lies along that direction, and never less than
// a minimum, so an end whose other end is behind it still bends out before turning back.
import type { XY } from "../document/types";
import { formatPoint, sideDirection } from "./path-format";
import type { HandleSide, PathEnds, PathResult } from "./types";

/** Options of {@link bezierPath}. */
export interface BezierPathOptions extends PathEnds {
    /** the share of the distance along a side its control point stands out by; default 0.5 */
    readonly curvature?: number | undefined;
}

/** The least distance a control point stands out from its end, in flow units. */
const MIN_REACH = 20;

/** The control point of the end at `from` (leaving by `side`), with the other end at `to`. */
function controlPoint(
    from: XY,
    side: HandleSide,
    to: XY,
    curvature: number,
): XY {
    const direction = sideDirection(side);
    const along = (to.x - from.x) * direction.x + (to.y - from.y) * direction.y;
    const reach = Math.max(MIN_REACH, Math.abs(along) * curvature);
    return {
        x: from.x + direction.x * reach,
        y: from.y + direction.y * reach,
    };
}

/**
 * A bezier edge's path from `source` to `target`, and its label point (the curve's middle,
 * `t = 0.5`).
 */
export function bezierPath(options: BezierPathOptions): PathResult {
    const { source, target, sourceSide, targetSide } = options;
    const curvature = options.curvature ?? 0.5;
    const c1 = controlPoint(source, sourceSide, target, curvature);
    const c2 = controlPoint(target, targetSide, source, curvature);
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
