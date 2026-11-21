// A straight edge: one line from end to end, its label halfway.
import type { XY } from "../document/types";
import { formatPoint } from "./path-format";
import type { PathResult } from "./types";

/** Options of {@link straightPath}: its two ends (the sides do not change a straight line). */
export interface StraightPathOptions {
    readonly source: XY;
    readonly target: XY;
}

/** A straight edge's path and its label point (the middle of the line). */
export function straightPath(options: StraightPathOptions): PathResult {
    const { source, target } = options;
    return {
        path: `M${formatPoint(source)} L${formatPoint(target)}`,
        label: { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 },
    };
}
