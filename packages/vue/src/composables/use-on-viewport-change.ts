import type { Viewport } from "@fragiola/flow";
import { type MaybeRefOrGetter, toValue, watchEffect } from "vue";
import { useFlowContext } from "../context";

export interface UseOnViewportChangeOptions {
    /** the viewport starts changing (`viewport-change-start`): a pan, a zoom, an animation */
    onStart?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
    /** each change of the viewport (`viewport-change`) */
    onChange?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
    /** the viewport stopped changing (`viewport-change-end`) */
    onEnd?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
}

/**
 * Calls back on the viewport's changes of the enclosing `Flow.Root` (the engine's events), without
 * rendering anything: `gesture` is true for a pan, the wheel, a pinch or auto-pan, false for an
 * action. `options` is a value, a ref or a getter, and its callbacks are read at each event (a
 * reactive object's, a ref's or a getter's latest).
 */
export function useOnViewportChange(
    options: MaybeRefOrGetter<UseOnViewportChangeOptions>,
): void {
    const context = useFlowContext("useOnViewportChange");
    watchEffect((onCleanup) => {
        const engine = context.engine.value;
        if (!engine) return;
        const stop = engine.subscribe((event) => {
            // read at each event, never tracked by this effect
            const now = toValue(options);
            if (event.type === "viewport-change-start") {
                now.onStart?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change") {
                now.onChange?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change-end") {
                now.onEnd?.(event.viewport, event.gesture);
            }
        });
        onCleanup(stop);
    });
}
