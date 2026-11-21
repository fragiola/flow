import type * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface ToggleInteractiveState {
    /** the gestures and keys may change the flow */
    readonly interactive: boolean;
}

export interface ToggleInteractiveProps
    extends ButtonPrimitiveProps<ToggleInteractiveState> {
    children?: React.ReactNode;
}

/**
 * A toggle button (`data-flow-part="toggle-interactive"`, `aria-pressed` while the flow is locked,
 * `data-interactive`): locks and unlocks the flow (`set-interactive`): while locked, gestures and
 * keys change nothing, pan and zoom stay. It renders only its children.
 */
export function ToggleInteractive(props: ToggleInteractiveProps) {
    const { children, ...rest } = props;
    const { model, engine } = useFlowContext("ToggleInteractive");
    const interactive = useFlowValue(model, engine, () =>
        engine ? engine.is("interactive") : true,
    );
    return useRenderElement("button", rest, {
        state: { interactive },
        props: {
            type: "button",
            "data-flow-part": "toggle-interactive",
            "data-interactive": interactive ? "" : undefined,
            "aria-pressed": !interactive,
            disabled: engine === null,
            onClick: () => {
                engine?.run("set-interactive", { interactive: !interactive });
            },
            children,
        },
    });
}
