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
    fields: () => object = () => ({}),
): {
    state: ComputedRef<ControlButtonState>;
    props: () => Record<string, unknown>;
} {
    const context = useFlowContext(part);
    // the fields its props give (an absent one is the engine's default)
    const payload = () => givenPayload(fields());
    const allowed = useFlowValue(context, () => {
        const engine = context.engine.value;
        return engine ? engine.can(action, payload() as never) : false;
    });
    const state = useFlowValue(context, () => ({
        disabled: disabledProp() === true || !allowed.value,
    }));
    const onClick = () => {
        context.engine.value?.run(action, payload() as never);
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

/** @internal a control's payload: the fields its props give (an absent one is the engine's default) */
export function givenPayload<P extends object>(fields: P): Partial<P> {
    return Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
    ) as Partial<P>;
}

/** `ZoomIn` → `zoom-in`. */
function partName(part: string): string {
    return part.replace(
        /[A-Z]/g,
        (letter, at: number) => `${at === 0 ? "" : "-"}${letter.toLowerCase()}`,
    );
}
