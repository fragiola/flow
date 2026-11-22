// The buttons of `Flow.Controls`: each runs one engine action, and is disabled while the engine
// refuses it (`engine.can`), re-rendering when the view changes.
import type { EngineActionKey } from "@fragiola/flow";
import type * as React from "react";
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
    payload: () => object,
    disabledProp: boolean | undefined,
): { state: ControlButtonState; props: Record<string, unknown> } {
    const { model, engine } = useFlowContext(part);
    const allowed = useFlowValue(model, engine, () =>
        engine ? engine.can(action, payload() as never) : false,
    );
    const disabled = disabledProp === true || !allowed;
    return {
        state: { disabled },
        props: {
            type: "button",
            "data-flow-part": partName(part),
            "data-disabled": disabled ? "" : undefined,
            disabled,
            onClick: (_event: React.MouseEvent) => {
                engine?.run(action, payload() as never);
            },
        },
    };
}

/** @internal a control's payload: its `duration` when given (an absent one is the engine's default) */
export function durationPayload(duration: number | undefined): {
    duration?: number;
} {
    return duration === undefined ? {} : { duration };
}

/** `ZoomIn` → `zoom-in`. */
function partName(part: string): string {
    return part.replace(
        /[A-Z]/g,
        (letter, at: number) => `${at === 0 ? "" : "-"}${letter.toLowerCase()}`,
    );
}
