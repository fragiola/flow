// Where an edge's toolbar goes (EdgeToolbar geometry): at a point of its drawn path on the screen
// (its label point, or one of its ends) or at a flow point given, outside the zoom, so it keeps its
// size whatever the zoom, centred on that point (or aligned by its start or end) and moved by a
// screen offset.

import type { EdgePath, Viewport } from "../geometry/types";
import { toScreen } from "../geometry/viewport-math";
import type { EdgeToolbarPayload, EdgeToolbarPosition } from "./verbs";

/** A toolbar's anchor for an edge's drawn path. */
export function edgeToolbarPosition(
    path: EdgePath,
    viewport: Viewport,
    payload: EdgeToolbarPayload,
): EdgeToolbarPosition {
    const at =
        payload.point ??
        (payload.position === "source"
            ? path.source
            : payload.position === "target"
              ? path.target
              : path.label);
    const point = toScreen(viewport, at);
    return {
        x: point.x + (payload.offset?.x ?? 0),
        y: point.y + (payload.offset?.y ?? 0),
        anchorX: share(payload.alignX),
        anchorY: share(payload.alignY),
    };
}

/** The share of the toolbar's size an alignment puts at the point. */
function share(align: EdgeToolbarPayload["alignX"]): number {
    return align === "start" ? 0 : align === "end" ? 1 : 0.5;
}
