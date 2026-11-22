import {
    type ControlButtonState,
    useControlButton,
} from "../composables/use-control-button";
import {
    definePrimitive,
    type FlowComponent,
    NUMBER_PROP,
    numberProp,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface ZoomOutProps extends PrimitiveProps {
    /** disabled even when the engine would run its action */
    disabled?: boolean | undefined;
    /**
     * how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at
     * once. The attribute's text is its number (`duration="300"`)
     */
    duration?: number | `${number}` | undefined;
}

export interface ZoomOutSlots extends RenderSlot<ControlButtonState> {
    /** its content (an icon, a label) */
    default?: SlotFunction<{ state: ControlButtonState }>;
}

/**
 * A button (`data-flow-part="zoom-out"`): Zooms out by a step around the root's centre (`zoom-out`), disabled at the least zoom. It renders only its default slot (an icon,
 * a label).
 */
export const ZoomOut: FlowComponent<ZoomOutProps, ZoomOutSlots> =
    definePrimitive<ZoomOutProps, ZoomOutSlots>(
        "ZoomOut",
        ["disabled", "duration", "as"],
        (props, { attrs, slots }) => {
            const { state, props: own } = useControlButton(
                "ZoomOut",
                "zoom-out",
                () => props.disabled,
                () => ({ duration: numberProp(props.duration) }),
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
        {
            booleans: ["disabled"],
            // `duration="300"` is its number
            types: { duration: NUMBER_PROP },
        },
    );
