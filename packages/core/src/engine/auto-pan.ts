// Auto-pan (the `autoPan` engine option): while a gesture that follows the pointer (a node drag,
// a connection, a reconnection, a selection box, a resize) has its pointer within `margin` pixels
// of the root's edge, or past it, the viewport pans towards that edge every frame, faster nearer
// it: no speed at `margin` pixels in, `speed` pixels a frame at the edge and beyond. The engine
// runs the one loop (`createFlowEngine`); this is its step.
import type { XY } from "../document/types";
import type { Size } from "../geometry/viewport-math";

/** How auto-pan pans (`autoPan: { speed, margin }`). */
export interface AutoPanOptions {
    /** the pixels a frame it pans with the pointer at the edge (or past it); default 10 */
    speed?: number | undefined;
    /** how near the edge (in pixels) the pointer starts it; default 30 */
    margin?: number | undefined;
}

const DEFAULT_SPEED = 10;
const DEFAULT_MARGIN = 30;

/**
 * The viewport offset of one auto-pan frame (zero when it does not pan) for a pointer at `point`
 * (relative to the root's top-left corner) in a root of `size`: positive towards the right and the
 * bottom, so a pointer near the left edge moves the flow right and shows what is left of the view.
 */
export function autoPanOffset(
    point: XY,
    size: Size,
    option: boolean | AutoPanOptions | undefined,
): XY {
    if (option === false || size.width <= 0 || size.height <= 0) {
        return { x: 0, y: 0 };
    }
    const own = option === true || option === undefined ? {} : option;
    const speed = Math.max(0, own.speed ?? DEFAULT_SPEED);
    const margin = Math.max(0, own.margin ?? DEFAULT_MARGIN);
    const axis = (at: number, length: number) => {
        const near = (gap: number) =>
            gap <= 0 || margin === 0 ? 1 : Math.max(0, 1 - gap / margin);
        if (at < margin) return speed * near(at);
        if (at > length - margin) return -speed * near(length - at);
        return 0;
    };
    // `+ 0` drops the sign of a zero
    return {
        x: axis(point.x, size.width) + 0,
        y: axis(point.y, size.height) + 0,
    };
}
