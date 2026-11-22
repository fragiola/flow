import {
    type ResizeHandleDirection,
    type ResizeHandleVariant,
    resizeHandleAttributes,
} from "@fragiola/flow";
import { useFlowValue } from "../composables/internal";
import { useFlowContext, usePartNodeId } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

/** A corner or a side of a node a `ResizeHandle` moves. */
export type ResizePosition =
    | "top-left"
    | "top"
    | "top-right"
    | "right"
    | "bottom-right"
    | "bottom"
    | "bottom-left"
    | "left";

/** Every position, corners then sides. */
export const RESIZE_POSITIONS: readonly ResizePosition[] = Object.freeze([
    "top-left",
    "top-right",
    "bottom-right",
    "bottom-left",
    "top",
    "right",
    "bottom",
    "left",
]);

export interface ResizeHandleState {
    readonly nodeId: string;
    readonly position: ResizePosition;
    /** its own direction, over its resizer's (`data-direction`); none: the resizer's */
    readonly direction: ResizeHandleDirection | undefined;
    /** how it is drawn (`data-variant`): a corner is always a `handle` */
    readonly variant: ResizeHandleVariant;
}

export interface ResizeHandleProps extends PrimitiveProps {
    /** the corner or side it moves */
    position: ResizePosition;
    /** its node; default the enclosing `Flow.Node`'s */
    nodeId?: string | undefined;
    /**
     * the sides it moves, over its resizer's `direction` (`data-direction`): `"horizontal"` only
     * the width (and x), `"vertical"` only the height (and y); default the resizer's
     */
    direction?: ResizeHandleDirection | undefined;
    /**
     * how it is drawn (`data-variant`, for your styles): `"handle"` (default) or `"line"`, a
     * side's whole length; a corner's `"line"` is ignored
     */
    variant?: ResizeHandleVariant | undefined;
}

export interface ResizeHandleSlots extends RenderSlot<ResizeHandleState> {
    default?: SlotFunction<{ state: ResizeHandleState }>;
}

/**
 * Where a handle sits: a corner's centre on the corner, a side's along the side. A corner is above
 * the two sides it joins (`zIndex`), so a press on it resizes both dimensions, whatever the order
 * of the handles.
 */
const PLACE: Record<ResizePosition, Record<string, string>> = {
    "top-left": {
        top: "0",
        left: "0",
        transform: "translate(-50%, -50%)",
        zIndex: "1",
    },
    "top-right": {
        top: "0",
        left: "100%",
        transform: "translate(-50%, -50%)",
        zIndex: "1",
    },
    "bottom-right": {
        top: "100%",
        left: "100%",
        transform: "translate(-50%, -50%)",
        zIndex: "1",
    },
    "bottom-left": {
        top: "100%",
        left: "0",
        transform: "translate(-50%, -50%)",
        zIndex: "1",
    },
    top: { top: "0", left: "0", width: "100%", transform: "translateY(-50%)" },
    bottom: {
        top: "100%",
        left: "0",
        width: "100%",
        transform: "translateY(-50%)",
    },
    left: {
        top: "0",
        left: "0",
        height: "100%",
        transform: "translateX(-50%)",
    },
    right: {
        top: "0",
        left: "100%",
        height: "100%",
        transform: "translateX(-50%)",
    },
};

/**
 * A grab area of a `NodeResizer` (`data-flow-part="resize-handle"`, `data-position`): a press on
 * it resizes its node from that corner or side (`resize()`); with `keyboard()` too it takes focus
 * and the arrows move that corner or side. Placed on its corner (centred) or
 * along its side; give it its size (a side's thickness) and look. Its `direction` overrides its
 * resizer's; `variant="line"` marks a side's handle as a line for your styles.
 */
export const ResizeHandle: FlowComponent<ResizeHandleProps, ResizeHandleSlots> =
    definePrimitive<ResizeHandleProps, ResizeHandleSlots>(
        "ResizeHandle",
        ["position", "nodeId", "direction", "variant", "as"],
        (props, { attrs, slots }) => {
            const nodeId = usePartNodeId("ResizeHandle", () => props.nodeId);
            const context = useFlowContext("ResizeHandle");
            // the engine's record: `data-position`, `data-variant`, `data-direction`, and
            // `tabindex` with `keyboard()` (arrows resize)
            const attributes = useFlowValue(context, () => {
                const engine = context.engine.value;
                const { position, direction, variant } = props;
                return engine
                    ? engine.adapter.attributes("resize-handle", {
                          nodeId: nodeId(),
                          position,
                          direction,
                          variant,
                      })
                    : resizeHandleAttributes(position, { direction, variant });
            });
            return () => {
                const own = attributes.value;
                const state: ResizeHandleState = {
                    nodeId: nodeId(),
                    position: props.position,
                    direction: own["data-direction"] as
                        | ResizeHandleDirection
                        | undefined,
                    variant: own["data-variant"] as ResizeHandleVariant,
                };
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: { ...own },
                    style: {
                        position: "absolute",
                        pointerEvents: "auto",
                        ...PLACE[props.position],
                    },
                    children: () => slots.default?.({ state }),
                });
            };
        },
    );
