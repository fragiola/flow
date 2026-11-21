import { partAttributes } from "@fragiola/flow";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

/** The state of `Flow.Controls` (none: its buttons have their own). */
export type ControlsState = Record<never, never>;

export interface ControlsProps extends PrimitiveProps {}

export interface ControlsSlots extends RenderSlot<ControlsState> {
    /** its buttons: `Flow.ZoomIn`, `Flow.ZoomOut`, `Flow.FitView`, `Flow.ToggleInteractive`, … */
    default?: SlotFunction<Record<never, never>>;
}

/**
 * A group of the viewport's buttons (`data-flow-part="controls"`): `Flow.ZoomIn`, `Flow.ZoomOut`,
 * `Flow.FitView`, `Flow.ToggleInteractive`, or your own. Inside `Flow.Root`, outside
 * `Flow.Viewport`; presses and the wheel over it are left to it. Place it with your style.
 */
export const Controls: FlowComponent<ControlsProps, ControlsSlots> =
    definePrimitive<ControlsProps, ControlsSlots>(
        "Controls",
        ["as"],
        (props, { attrs, slots }) =>
            () =>
                renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state: {},
                    props: { ...partAttributes("controls") },
                    children: () => slots.default?.({}),
                }),
    );
