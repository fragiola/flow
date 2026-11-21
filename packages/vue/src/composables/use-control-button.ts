// The buttons of `Flow.Controls`: each runs one engine action, and is disabled while the engine
// refuses it (`engine.can`), re-rendering when the view changes.
import type { EngineActionKey } from "@fragiola/flow";
import type { ComputedRef } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/** What a control button shows. */
export interface ControlButtonState {
    /** the engine refuses its action now (a zoom at its limit, `fit-view` before a size) */
    readonly disabled: boolean;
}

/** @internal a control button's state and own props: it runs `action` when clicked */
export function useControlButton(
    part: string,
    action: EngineActionKey,
    disabledProp: () => boolean | undefined,
): {
    state: ComputedRef<ControlButtonState>;
    props: () => Record<string, unknown>;
} {
    const context = useFlowContext(part);
    const allowed = useFlowValue(context, () => {
        const engine = context.engine.value;
        return engine ? engine.can(action, {} as never) : false;
    });
    const state = useFlowValue(context, () => ({
        disabled: disabledProp() === true || !allowed.value,
    }));
    const onClick = () => {
        context.engine.value?.run(action, {} as never);
    };
    return {
        state,
        props: () => {
            const { disabled } = state.value;
            return {
                type: "button",
                "data-flow-part": partName(part),
                "data-disabled": disabled ? "" : undefined,
                disabled,
                onClick,
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
