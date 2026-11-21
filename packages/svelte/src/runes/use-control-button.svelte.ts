// The buttons of `Flow.Controls`: each runs one engine action, and is disabled while the engine
// refuses it (`engine.can`), following the view.
import type { EngineActionKey } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { flowValue } from "./internal.svelte.js";

/** What a control button shows. */
export interface ControlButtonState {
    /** the engine refuses its action now (a zoom at its limit, `fit-view` before a size) */
    readonly disabled: boolean;
}

/** @internal a control button's state and own props: it runs `action` when clicked */
export function useControlButton(
    part: string,
    action: EngineActionKey,
    disabledProp: () => boolean | null | undefined,
): {
    readonly state: ControlButtonState;
    readonly props: Record<string, unknown>;
} {
    const context = useFlowContext(part);
    const allowed = flowValue(context, () =>
        context.engine ? context.engine.can(action, {} as never) : false,
    );
    const disabled = $derived(disabledProp() === true || !allowed.current);
    const onclick = () => {
        context.engine?.run(action, {} as never);
    };
    return {
        get state() {
            return { disabled };
        },
        get props() {
            return {
                type: "button",
                "data-flow-part": partName(part),
                "data-disabled": disabled ? "" : undefined,
                disabled,
                onclick,
            };
        },
    };
}

/** `ZoomIn` → `zoom-in`. */
function partName(part: string): string {
    return part.replace(
        /[A-Z]/g,
        (letter, at: number) => `${at === 0 ? "" : "-"}${letter.toLowerCase()}`,
    );
}
