// An animated viewport change (a viewport action's `duration`): from one viewport to another over
// a time, eased, one step per frame of the root's window (never the global one). The first frame
// starts the clock, so the time runs from when the window first paints it. x, y and the zoom move
// by the same eased share, so a zoom around a point keeps that point still all the way.
import type { Viewport } from "../geometry/types";

/** How an animation's share of time becomes its share of the way (0 → 0, 1 → 1). */
export type ViewportEasing = (t: number) => number;

/** The default easing: slow at both ends (a cubic ease in and out). */
function smooth(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/** What {@link animateViewport} takes. */
export interface ViewportAnimationOptions {
    /** the window whose frames it runs on (the root's `defaultView`) */
    readonly view: Window;
    readonly from: Viewport;
    readonly to: Viewport;
    /** in milliseconds, above 0 */
    readonly duration: number;
    /** default a smooth ease in and out */
    readonly easing?: ViewportEasing | undefined;
    /** sets one frame's viewport (the last one is `to`) */
    readonly step: (viewport: Viewport) => void;
    /** the last frame was set */
    readonly done: () => void;
}

/** Animates the viewport from `from` to `to`; returns its stop (the pending frame cancelled). */
export function animateViewport(options: ViewportAnimationOptions): () => void {
    const { view, from, to, duration, step, done } = options;
    const easing = options.easing ?? smooth;
    let start: number | undefined;
    let frame: number | undefined;
    let stopped = false;
    const tick = (time: number) => {
        frame = undefined;
        start ??= time;
        const t = duration > 0 ? (time - start) / duration : 1;
        if (t >= 1) {
            step(to);
            done();
            return;
        }
        const share = easing(Math.max(0, t));
        const at = (a: number, b: number) => a + (b - a) * share;
        step({
            x: at(from.x, to.x),
            y: at(from.y, to.y),
            zoom: at(from.zoom, to.zoom),
        });
        // a listener of this step may have stopped it (another action)
        if (!stopped) frame = view.requestAnimationFrame(tick);
    };
    frame = view.requestAnimationFrame(tick);
    return () => {
        stopped = true;
        if (frame !== undefined) view.cancelAnimationFrame(frame);
        frame = undefined;
    };
}
