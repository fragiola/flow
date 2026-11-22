import { effect, untracked } from "@angular/core";
import type { Viewport } from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { type ValueOrSignal, valueNow } from "./internal";

export interface InjectOnViewportChangeOptions {
    /** the viewport starts changing (`viewport-change-start`): a pan, a zoom, an animation */
    onStart?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
    /** each change of the viewport (`viewport-change`) */
    onChange?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
    /** the viewport stopped changing (`viewport-change-end`) */
    onEnd?: ((viewport: Viewport, gesture: boolean) => void) | undefined;
}

/**
 * Calls back on the viewport's changes of the enclosing `[flowRoot]` (the engine's events, React's
 * `useOnViewportChange`), marking nothing for a check: `gesture` is true for a pan, the wheel, a
 * pinch or auto-pan, false for an action. The options are a value, a signal or a getter, read at
 * each event (the latest callbacks are called). Call it in an injection context (a constructor or
 * a field).
 */
export function injectOnViewportChange(
    options: ValueOrSignal<InjectOnViewportChangeOptions>,
): void {
    const context = injectFlowContext("injectOnViewportChange");
    effect((onCleanup) => {
        const engine = context.engine();
        if (!engine) return;
        const stop = untracked(() =>
            engine.subscribe((event) => {
                if (
                    event.type !== "viewport-change-start" &&
                    event.type !== "viewport-change" &&
                    event.type !== "viewport-change-end"
                ) {
                    return;
                }
                const { onStart, onChange, onEnd } =
                    untracked(() => valueNow(options)) ?? {};
                const call =
                    event.type === "viewport-change-start"
                        ? onStart
                        : event.type === "viewport-change"
                          ? onChange
                          : onEnd;
                call?.(event.viewport, event.gesture);
            }),
        );
        onCleanup(stop);
    });
}
