import type * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

/** The switches the lock turns off and on (React Flow's: dragging, connecting, selecting). */
const LOCKED_KINDS = ["drag", "connect", "select"] as const;

export interface ToggleInteractiveState {
    /**
     * the flow is not locked: it is interactive and one of dragging, connecting and selecting at
     * least is on (`interactive-by`)
     */
    readonly interactive: boolean;
}

export interface ToggleInteractiveProps
    extends ButtonPrimitiveProps<ToggleInteractiveState> {
    children?: React.ReactNode;
}

/**
 * A toggle button (`data-flow-part="toggle-interactive"`, `aria-pressed` while the flow is locked,
 * `data-interactive`): locks and unlocks the flow, React Flow's interactive button: locking turns
 * dragging, connecting and selecting off (`set-interactive { drag, connect, select }`), unlocking
 * turns them and `interactive` on; pan and zoom stay. It renders only its children.
 */
export function ToggleInteractive(props: ToggleInteractiveProps) {
    const { children, ...rest } = props;
    const { model, engine } = useFlowContext("ToggleInteractive");
    const interactive = useFlowValue(model, engine, () =>
        engine
            ? LOCKED_KINDS.some((kind) => engine.is("interactive-by", { kind }))
            : true,
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
                engine?.run(
                    "set-interactive",
                    interactive
                        ? { drag: false, connect: false, select: false }
                        : {
                              interactive: true,
                              drag: true,
                              connect: true,
                              select: true,
                          },
                );
            },
            children,
        },
    });
}
