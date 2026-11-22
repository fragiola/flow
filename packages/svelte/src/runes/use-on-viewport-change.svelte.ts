import type { Viewport } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { type MaybeGetter, read } from "./internal.svelte.js";

export interface UseOnViewportChangeOptions {
    /** the viewport starts changing (`viewport-change-start`): a pan, a zoom, an animation */
    onstart?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
    /** each change of the viewport (`viewport-change`) */
    onchange?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
    /** the viewport stopped changing (`viewport-change-end`) */
    onend?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
}

/**
 * Calls back on the viewport's changes of the enclosing `Flow.Root` (the engine's events), without
 * updating anything: `gesture` is true for a pan, the wheel, a pinch or auto-pan, false for an
 * action. Pass the callbacks, or a getter of them (props): they are read at each event, so the
 * latest are called. Call it in a component's script, inside the root.
 */
export function useOnViewportChange(
    options: MaybeGetter<UseOnViewportChangeOptions>,
): void {
    const context = useFlowContext("useOnViewportChange");
    $effect(() => {
        const engine = context.engine;
        if (!engine) return;
        return engine.subscribe((event) => {
            const { onstart, onchange, onend } = read(options);
            if (event.type === "viewport-change-start") {
                onstart?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change") {
                onchange?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change-end") {
                onend?.(event.viewport, event.gesture);
            }
        });
    });
}
