import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import { h, provide } from "vue";
import { type EdgeState, useEdge } from "../composables/use-edge";
import { EdgeKey } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";
import { EdgePath } from "./edge-path";

export interface EdgeProps<T extends FlowTypes = AnyTypes>
    extends PrimitiveProps {
    /** the edge it draws: the one `Flow.Edges` gives its slot */
    edge: FlowEdge<T>;
}

export interface EdgeSlots<T extends FlowTypes = AnyTypes>
    extends RenderSlot<EdgeState<T>> {
    /** its parts: default a `Flow.EdgePath` */
    default?: SlotFunction<{ state: EdgeState<T> }>;
}

const EDGE_STYLE = { pointerEvents: "visibleStroke" };

/**
 * One edge (`data-flow-part="edge"`, `data-flow-id`): an SVG group inside `Flow.Edges`, drawn once
 * both its nodes have a size. It renders its default slot (`Flow.EdgePath` by default,
 * `Flow.EdgeLabel`, `Flow.ReconnectAnchor`); a press on its stroke selects it (`selection()`).
 */
export const Edge: FlowComponent<EdgeProps, EdgeSlots> = definePrimitive<
    EdgeProps,
    EdgeSlots
>("Edge", ["edge", "as"], (props, { attrs, slots }) => {
    const { state, props: own } = useEdge(() => props.edge);
    provide(EdgeKey, { edgeId: () => props.edge.id });
    return () => {
        const current = state.value;
        if (!current.path) return null;
        return renderElement({
            tag: "g",
            as: props.as,
            attrs,
            render: slots.render,
            state: current,
            props: { ...own.value },
            style: EDGE_STYLE,
            children: () =>
                slots.default ? slots.default({ state: current }) : h(EdgePath),
        });
    };
});
