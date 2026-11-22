import type * as React from "react";
import {
    type ControlButtonState,
    durationPayload,
    useControlButton,
} from "../hooks/use-control-button";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface FitViewProps extends ButtonPrimitiveProps<ControlButtonState> {
    /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
    duration?: number | undefined;
    children?: React.ReactNode;
}

/**
 * A button (`data-flow-part="fit-view"`): Fits every node in the root (`fit-view`), disabled before a node is measured. It renders only its
 * children (an icon, a label).
 */
export function FitView(props: FitViewProps) {
    const { children, disabled, duration, ...rest } = props;
    const { state, props: own } = useControlButton(
        "FitView",
        "fit-view",
        () => durationPayload(duration),
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
