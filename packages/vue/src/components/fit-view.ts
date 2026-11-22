import type { FitPadding } from "@fragiola/flow";
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

export interface FitViewProps extends PrimitiveProps {
    /** disabled even when the engine would run its action */
    disabled?: boolean | undefined;
    /**
     * how long its viewport change animates, in milliseconds (the root's `easing`); default 0: at
     * once. The attribute's text is its number (`duration="300"`)
     */
    duration?: number | `${number}` | undefined;
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
    minZoom?: number | `${number}` | undefined;
    /** the greatest zoom it may pick (within the root's limits); default the root's `maxZoom` */
    maxZoom?: number | `${number}` | undefined;
}

export interface FitViewSlots extends RenderSlot<ControlButtonState> {
    /** its content (an icon, a label) */
    default?: SlotFunction<{ state: ControlButtonState }>;
}

/**
 * A button (`data-flow-part="fit-view"`): Fits every node in the root, or its `nodeIds` (`fit-view`, with its props as the payload), disabled before a node is measured. It renders only its default slot (an icon,
 * a label).
 */
export const FitView: FlowComponent<FitViewProps, FitViewSlots> =
    definePrimitive<FitViewProps, FitViewSlots>(
        "FitView",
        [
            "disabled",
            "duration",
            "padding",
            "nodeIds",
            "includeHidden",
            "minZoom",
            "maxZoom",
            "as",
        ],
        (props, { attrs, slots }) => {
            const { state, props: own } = useControlButton(
                "FitView",
                "fit-view",
                () => props.disabled,
                // `nodeIds` spread: a reactive array reaches the engine as a copy
                () => ({
                    duration: numberProp(props.duration),
                    padding: props.padding,
                    nodeIds: props.nodeIds ? [...props.nodeIds] : undefined,
                    includeHidden: props.includeHidden,
                    minZoom: numberProp(props.minZoom),
                    maxZoom: numberProp(props.maxZoom),
                }),
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
            booleans: ["disabled", "includeHidden"],
            // `duration="300"` is its number (`min-zoom`, `max-zoom` too)
            types: {
                duration: NUMBER_PROP,
                minZoom: NUMBER_PROP,
                maxZoom: NUMBER_PROP,
            },
        },
    );
