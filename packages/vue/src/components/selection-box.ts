import type { Rect } from "@fragiola/flow";
import { useFlowValue } from "../composables/internal";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { px, type RenderSlot, renderElement } from "../utils/render";

export interface SelectionBoxState {
    /** the box, in pixels relative to the root */
    readonly box: Rect;
}

export interface SelectionBoxProps extends PrimitiveProps {}

export interface SelectionBoxSlots extends RenderSlot<SelectionBoxState> {
    default?: SlotFunction<{ state: SelectionBoxState }>;
}

/**
 * The box selection being drawn (`data-flow-part="selection-box"`, `selection()`): absolutely
 * positioned in `Flow.Root` (outside `Flow.Viewport`: it is in screen pixels), rendered only
 * while a box is drawn. Give it its look.
 */
export const SelectionBox: FlowComponent<SelectionBoxProps, SelectionBoxSlots> =
    definePrimitive<SelectionBoxProps, SelectionBoxSlots>(
        "SelectionBox",
        ["as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("SelectionBox");
            const box = useFlowValue(
                context,
                () => context.engine.value?.get("selection-box") ?? null,
            );
            const attributes = useFlowValue(
                context,
                () =>
                    context.engine.value?.adapter.attributes("selection-box") ??
                    {},
            );
            return () => {
                const current = box.value;
                if (!current) return null;
                const state: SelectionBoxState = { box: current };
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: {
                        ...attributes.value,
                        "data-flow-part": "selection-box",
                    },
                    style: {
                        position: "absolute",
                        left: px(current.x),
                        top: px(current.y),
                        width: px(current.width),
                        height: px(current.height),
                        pointerEvents: "none",
                    },
                    children: () => slots.default?.({ state }),
                });
            };
        },
    );
