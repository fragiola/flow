import type { HandleSide } from "@fragiola/flow";
import {
    type HandleState,
    type UseHandleOptions,
    useHandle,
} from "../composables/use-handle";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface HandleProps extends PrimitiveProps, UseHandleOptions {}

export interface HandleSlots extends RenderSlot<HandleState> {
    default?: SlotFunction<{ state: HandleState }>;
}

/** Where a handle sits by default: centred on its side of the node (a style may move it). */
const SIDE_STYLE: Record<HandleSide, Record<string, string>> = {
    top: { top: "0", left: "50%", transform: "translate(-50%, -50%)" },
    right: { top: "50%", left: "100%", transform: "translate(-50%, -50%)" },
    bottom: { top: "100%", left: "50%", transform: "translate(-50%, -50%)" },
    left: { top: "50%", left: "0", transform: "translate(-50%, -50%)" },
};

const HANDLE_STYLE = { position: "absolute" };

/**
 * A node's connection point (`data-flow-part="handle"`, `data-handle-type`, `data-side`), inside
 * `Flow.Node`: registered with the engine (D8), which measures its centre; with `connection()`, a
 * press on it draws a connection. Absolutely positioned at the middle of its `side` by default;
 * your `style` may place it elsewhere on the node. Give it its size and look.
 */
export const Handle: FlowComponent<HandleProps, HandleSlots> = definePrimitive<
    HandleProps,
    HandleSlots
>(
    "Handle",
    ["type", "side", "handleId", "connectable", "nodeId", "as"],
    (props, { attrs, slots }) => {
        const { state, props: own } = useHandle(() => ({
            type: props.type,
            side: props.side,
            handleId: props.handleId,
            connectable: props.connectable,
            nodeId: props.nodeId,
        }));
        return () => {
            const current = state.value;
            const { ref, ...attributes } = own.value;
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state: current,
                ref,
                props: attributes,
                style: HANDLE_STYLE,
                baseStyle: SIDE_STYLE[props.side],
                children: () => slots.default?.({ state: current }),
            });
        };
    },
    { booleans: ["connectable"] },
);
