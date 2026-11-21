import {
    type ControlButtonState,
    useControlButton,
} from "../composables/use-control-button";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ZoomInProps extends PrimitiveProps {
    /** disabled even when the engine would run its action */
    disabled?: boolean | undefined;
}

export interface ZoomInSlots extends RenderSlot<ControlButtonState> {
    /** its content (an icon, a label) */
    default?: SlotFunction<{ state: ControlButtonState }>;
}

/**
 * A button (`data-flow-part="zoom-in"`): Zooms in by a step around the root's centre (`zoom-in`), disabled at the greatest zoom. It renders only its default slot (an icon,
 * a label).
 */
export const ZoomIn: FlowComponent<ZoomInProps, ZoomInSlots> = definePrimitive<
    ZoomInProps,
    ZoomInSlots
>(
    "ZoomIn",
    ["disabled", "as"],
    (props, { attrs, slots }) => {
        const { state, props: own } = useControlButton(
            "ZoomIn",
            "zoom-in",
            () => props.disabled,
        );
        return () => {
            const current = state.value;
            return renderElement({
                tag: "button",
                as: props.as,
                attrs,
                render: slots.render,
                state: current,
                props: own(),
                children: () => slots.default?.({ state: current }),
            });
        };
    },
    { booleans: ["disabled"] },
);
