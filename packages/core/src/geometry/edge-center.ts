// The middle of an edge's two ends, and how far each lies from it: where a straight edge's label
// goes, and the point an app's own path may centre a label or a turn on.
import type { XY } from "../document/types";

/** The middle of two ends, and the distance across (x) and down (y) from it to either end. */
export interface EdgeCenter {
    /** the point halfway between the ends, in flow coordinates */
    readonly center: XY;
    /** half the distance between the ends across (x) and down (y), both positive */
    readonly offset: XY;
}

/** The point halfway between an edge's `source` and `target`, and how far each end lies from it. */
export function edgeCenter(source: XY, target: XY): EdgeCenter {
    return {
        center: {
            x: (source.x + target.x) / 2,
            y: (source.y + target.y) / 2,
        },
        offset: {
            x: Math.abs(target.x - source.x) / 2,
            y: Math.abs(target.y - source.y) / 2,
        },
    };
}
