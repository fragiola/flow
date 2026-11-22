// Where a node's toolbar goes (NodeToolbar geometry): beside one side of the node (or of several
// nodes' bounds) on the screen, outside the zoom, so it keeps its size whatever the zoom.
import type { Rect, Viewport } from "../geometry/types";
import type { NodeToolbarPayload, NodeToolbarPosition } from "./verbs";

/** A toolbar's anchor for a node's absolute box (or several nodes' bounds). */
export function nodeToolbarPosition(
    rect: Rect,
    viewport: Viewport,
    payload: NodeToolbarPayload,
): NodeToolbarPosition {
    const side = payload.side ?? "top";
    const align = payload.align ?? "center";
    const offset = payload.offset ?? 10;
    const { zoom } = viewport;
    const left = rect.x * zoom + viewport.x;
    const top = rect.y * zoom + viewport.y;
    const width = rect.width * zoom;
    const height = rect.height * zoom;
    const share = align === "start" ? 0 : align === "end" ? 1 : 0.5;
    switch (side) {
        case "top":
            return {
                x: left + width * share,
                y: top - offset,
                anchorX: share,
                anchorY: 1,
            };
        case "bottom":
            return {
                x: left + width * share,
                y: top + height + offset,
                anchorX: share,
                anchorY: 0,
            };
        case "left":
            return {
                x: left - offset,
                y: top + height * share,
                anchorX: 1,
                anchorY: share,
            };
        case "right":
            return {
                x: left + width + offset,
                y: top + height * share,
                anchorX: 0,
                anchorY: share,
            };
    }
}
