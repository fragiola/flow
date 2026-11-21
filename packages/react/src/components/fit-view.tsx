import type * as React from "react";
import {
    type ControlButtonState,
    useControlButton,
} from "../hooks/use-control-button";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface FitViewProps extends ButtonPrimitiveProps<ControlButtonState> {
    children?: React.ReactNode;
}

const NO_PAYLOAD = () => ({});

/**
 * A button (`data-flow-part="fit-view"`): Fits every node in the root (`fit-view`), disabled before a node is measured. It renders only its
 * children (an icon, a label).
 */
export function FitView(props: FitViewProps) {
    const { children, disabled, ...rest } = props;
    const { state, props: own } = useControlButton(
        "FitView",
        "fit-view",
        NO_PAYLOAD,
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
