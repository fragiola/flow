import type { FitPadding } from "@fragiola/flow";
import type * as React from "react";
import {
    type ControlButtonState,
    givenPayload,
    useControlButton,
} from "../hooks/use-control-button";
import {
    type ButtonPrimitiveProps,
    useRenderElement,
} from "../utils/use-render";

export interface FitViewProps extends ButtonPrimitiveProps<ControlButtonState> {
    /** how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at once */
    duration?: number | undefined;
    /**
     * the room kept free on every side: a share of the root's size, `"<n>px"`, or each side's
     * (`{ top, right, bottom, left }`); default the engine's 0.1
     */
    padding?: FitPadding | undefined;
    /** only these nodes; default every node that is not hidden */
    nodeIds?: string[] | undefined;
    /** without `nodeIds`, the hidden nodes of known size too; default false */
    includeHidden?: boolean | undefined;
    /** the least zoom it may pick (within the root's limits); default the root's `minZoom` */
    minZoom?: number | undefined;
    /** the greatest zoom it may pick (within the root's limits); default the root's `maxZoom` */
    maxZoom?: number | undefined;
    children?: React.ReactNode;
}

/**
 * A button (`data-flow-part="fit-view"`): Fits every node in the root, or its `nodeIds` (`fit-view`, with its props as the payload), disabled before a node is measured. It renders only its
 * children (an icon, a label).
 */
export function FitView(props: FitViewProps) {
    const {
        children,
        disabled,
        duration,
        padding,
        nodeIds,
        includeHidden,
        minZoom,
        maxZoom,
        ...rest
    } = props;
    const { state, props: own } = useControlButton(
        "FitView",
        "fit-view",
        () =>
            givenPayload({
                duration,
                padding,
                nodeIds,
                includeHidden,
                minZoom,
                maxZoom,
            }),
        disabled,
    );
    return useRenderElement("button", rest, {
        state,
        props: { ...own, children },
    });
}
