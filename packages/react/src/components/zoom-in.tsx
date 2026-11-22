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

export interface ZoomInProps extends ButtonPrimitiveProps<ControlButtonState> {
    /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
    duration?: number | undefined;
    children?: React.ReactNode;
}

/**
 * A button (`data-flow-part="zoom-in"`): Zooms in by a step around the root's centre (`zoom-in`), disabled at the greatest zoom. It renders only its
 * children (an icon, a label).
 */
export function ZoomIn(props: ZoomInProps) {
    const { children, disabled, duration, ...rest } = props;
    const { state, props: own } = useControlButton(
        "ZoomIn",
        "zoom-in",
        () => durationPayload(duration),
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
