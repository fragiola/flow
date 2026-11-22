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

export interface ZoomOutProps extends ButtonPrimitiveProps<ControlButtonState> {
    /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
    duration?: number | undefined;
    children?: React.ReactNode;
}

/**
 * A button (`data-flow-part="zoom-out"`): Zooms out by a step around the root's centre (`zoom-out`), disabled at the least zoom. It renders only its
 * children (an icon, a label).
 */
export function ZoomOut(props: ZoomOutProps) {
    const { children, disabled, duration, ...rest } = props;
    const { state, props: own } = useControlButton(
        "ZoomOut",
        "zoom-out",
        () => durationPayload(duration),
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
