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

export interface ZoomInProps extends PrimitiveProps {
    /** disabled even when the engine would run its action */
    disabled?: boolean | undefined;
    /**
     * how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at
     * once. The attribute's text is its number (`duration="300"`)
     */
    duration?: number | `${number}` | undefined;
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
    ["disabled", "duration", "as"],
    (props, { attrs, slots }) => {
        const { state, props: own } = useControlButton(
            "ZoomIn",
            "zoom-in",
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
