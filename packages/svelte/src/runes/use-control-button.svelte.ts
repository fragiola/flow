// The buttons of `Flow.Controls`: each runs one engine action, and is disabled while the engine
// refuses it (`engine.can`), following the view.
import type { EngineActionKey } from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { plain } from "../utils/plain.svelte.js";
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
    fields: () => object = () => ({}),
): {
    readonly state: ControlButtonState;
    readonly props: Record<string, unknown>;
} {
    const context = useFlowContext(part);
    // the fields its props give (an absent one is the engine's default)
    const payload = () => givenPayload(fields());
    const allowed = flowValue(context, () =>
        context.engine ? context.engine.can(action, payload() as never) : false,
    );
    const disabled = $derived(disabledProp() === true || !allowed.current);
    const onclick = () => {
        context.engine?.run(action, payload() as never);
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

/**
 * @internal a control's payload: the fields its props give (an absent one is the engine's
 * default), without a `$state` proxy
 */
export function givenPayload<P extends object>(fields: P): Partial<P> {
    return Object.fromEntries(
        Object.entries(fields)
            .filter(([, value]) => value !== undefined)
            .map(([name, value]) => [name, plain(value)]),
    ) as Partial<P>;
}

/** `ZoomIn` → `zoom-in`. */
function partName(part: string): string {
    return part.replace(
        /[A-Z]/g,
        (letter, at: number) => `${at === 0 ? "" : "-"}${letter.toLowerCase()}`,
    );
}
