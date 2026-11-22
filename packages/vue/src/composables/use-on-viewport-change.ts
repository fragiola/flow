import type { Viewport } from "@fragiola/flow";
import { watchEffect } from "vue";
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
 * action. The callbacks of `options` are read at each event (a reactive object's latest).
 */
export function useOnViewportChange(options: UseOnViewportChangeOptions): void {
    const context = useFlowContext("useOnViewportChange");
    watchEffect((onCleanup) => {
        const engine = context.engine.value;
        if (!engine) return;
        const stop = engine.subscribe((event) => {
            if (event.type === "viewport-change-start") {
                options.onStart?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change") {
                options.onChange?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change-end") {
                options.onEnd?.(event.viewport, event.gesture);
            }
        });
        onCleanup(stop);
    });
}
