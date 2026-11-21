import type * as React from "react";
import {
    type ControlButtonState,
    useControlButton,
} from "../hooks/use-control-button";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface ZoomOutProps extends ButtonPrimitiveProps<ControlButtonState> {
    children?: React.ReactNode;
}

const NO_PAYLOAD = () => ({});

/**
 * A button (`data-flow-part="zoom-out"`): Zooms out by a step around the root's centre (`zoom-out`), disabled at the least zoom. It renders only its
 * children (an icon, a label).
 */
export function ZoomOut(props: ZoomOutProps) {
    const { children, disabled, ...rest } = props;
    const { state, props: own } = useControlButton(
        "ZoomOut",
        "zoom-out",
        NO_PAYLOAD,
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
