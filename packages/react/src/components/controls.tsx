import { partAttributes } from "@fragiola/flow";
import type * as React from "react";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

/** The state of `Flow.Controls` (none: its buttons have their own). */
export type ControlsState = Record<never, never>;

export interface ControlsProps extends DivPrimitiveProps<ControlsState> {
    children?: React.ReactNode;
}

/**
 * A group of the viewport's buttons (`data-flow-part="controls"`): `Flow.ZoomIn`, `Flow.ZoomOut`,
 * `Flow.FitView`, `Flow.ToggleInteractive`, or your own. Inside `Flow.Root`, outside
 * `Flow.Viewport`; presses and the wheel over it are left to it. Place it with your style.
 */
export function Controls(props: ControlsProps) {
    const { children, ...rest } = props;
    return useRenderElement("div", rest, {
        state: {},
        props: { ...partAttributes("controls"), children },
    });
}
