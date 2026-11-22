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

export interface NodesSelectionState {
    /** the rectangle around the selected nodes, in flow coordinates */
    readonly rect: Rect;
    /** the selection is being dragged by it: `data-dragging` */
    readonly dragging: boolean;
}

export interface NodesSelectionProps extends PrimitiveProps {}

export interface NodesSelectionSlots extends RenderSlot<NodesSelectionState> {
    default?: SlotFunction<{ state: NodesSelectionState }>;
}

/**
 * The rectangle around the selected nodes (`data-flow-part="nodes-selection"`, `selection()`),
 * inside `Flow.Viewport` next to `Flow.Nodes` (it is in flow coordinates): rendered at
 * `selection-rect`, while two or more nodes are selected by a box (or always, with
 * `selection({ rect: "always" })`). A press on it drags the selection (`drag()`), its context
 * menu is the selection's. With `keyboard()` it takes focus (`tabindex`), and its keys are a
 * focused selected node's: the arrows move the selection, the delete keys remove it, Escape clears
 * it. Give it its look.
 */
export const NodesSelection: FlowComponent<
    NodesSelectionProps,
    NodesSelectionSlots
> = definePrimitive<NodesSelectionProps, NodesSelectionSlots>(
    "NodesSelection",
    ["as"],
    (props, { attrs, slots }) => {
        const context = useFlowContext("NodesSelection");
        const rect = useFlowValue(
            context,
            () => context.engine.value?.get("selection-rect") ?? null,
        );
        // read only while the rectangle is shown
        const attributes = useFlowValue(
            context,
            () =>
                context.engine.value?.adapter.attributes("nodes-selection") ??
                {},
        );
        return () => {
            const current = rect.value;
            if (!current) return null;
            const own = attributes.value;
            const state: NodesSelectionState = {
                rect: current,
                dragging: own["data-dragging"] !== undefined,
            };
            return renderElement({
                tag: "div",
                as: props.as,
                attrs,
                render: slots.render,
                state,
                props: { ...own, "data-flow-part": "nodes-selection" },
                style: {
                    position: "absolute",
                    top: "0",
                    left: "0",
                    transform: `translate(${px(current.x)}, ${px(current.y)})`,
                    width: px(current.width),
                    height: px(current.height),
                },
                children: () => slots.default?.({ state }),
            });
        };
    },
);
