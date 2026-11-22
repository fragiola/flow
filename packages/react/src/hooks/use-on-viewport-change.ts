import type { Viewport } from "@fragiola/flow";
import * as React from "react";
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
 * Calls back on the viewport's changes of the enclosing `Flow.Root` (the engine's events),
 * without re-rendering the component: `gesture` is true for a pan, the wheel, a pinch or auto-pan,
 * false for an action. The latest callbacks are called.
 */
export function useOnViewportChange(options: UseOnViewportChangeOptions): void {
    const { engine } = useFlowContext("useOnViewportChange");
    const latest = React.useRef(options);
    latest.current = options;
    React.useEffect(() => {
        if (!engine) return;
        return engine.subscribe((event) => {
            const { onStart, onChange, onEnd } = latest.current;
            if (event.type === "viewport-change-start") {
                onStart?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change") {
                onChange?.(event.viewport, event.gesture);
            } else if (event.type === "viewport-change-end") {
                onEnd?.(event.viewport, event.gesture);
            }
        });
    }, [engine]);
}
