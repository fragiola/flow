// Where an edge's toolbar goes (EdgeToolbar geometry): at a point of its drawn path on the screen
// (its label point, or one of its ends), outside the zoom, so it keeps its size whatever the zoom,
// centred on that point and moved by a screen offset.

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
        payload.position === "source"
            ? path.source
            : payload.position === "target"
              ? path.target
              : path.label;
    const point = toScreen(viewport, at);
    return {
        x: point.x + (payload.offset?.x ?? 0),
        y: point.y + (payload.offset?.y ?? 0),
        anchorX: 0.5,
        anchorY: 0.5,
    };
}
