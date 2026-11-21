import type * as React from "react";
import {
    type ControlButtonState,
    useControlButton,
} from "../hooks/use-control-button";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface ZoomInProps extends ButtonPrimitiveProps<ControlButtonState> {
    children?: React.ReactNode;
}

const NO_PAYLOAD = () => ({});

/**
 * A button (`data-flow-part="zoom-in"`): Zooms in by a step around the root's centre (`zoom-in`), disabled at the greatest zoom. It renders only its
 * children (an icon, a label).
 */
export function ZoomIn(props: ZoomInProps) {
    const { children, disabled, ...rest } = props;
    const { state, props: own } = useControlButton(
        "ZoomIn",
        "zoom-in",
        NO_PAYLOAD,
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
