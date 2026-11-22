import type { AnyTypes, FlowEdge, FlowTypes } from "@fragiola/flow";
import { h, nextTick, provide } from "vue";
import { type EdgeState, useEdge } from "../composables/use-edge";
import { EdgeKey, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { elementRef, type RenderSlot, renderElement } from "../utils/render";
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
 * both its nodes have a size (before the engine, the sizes its document gives: a server render
 * draws it). Mounted again in another render level's layer, it takes back the focus it had. It renders its default slot (`Flow.EdgePath` by default,
 * `Flow.EdgeLabel`, `Flow.ReconnectAnchor`); a press on its stroke selects it (`selection()`).
 */
export const Edge: FlowComponent<EdgeProps, EdgeSlots> = definePrimitive<
    EdgeProps,
    EdgeSlots
>("Edge", ["edge", "as"], (props, { attrs, slots }) => {
    const context = useFlowContext("Edge");
    const { state, props: own } = useEdge(() => props.edge);
    provide(EdgeKey, { edgeId: () => props.edge.id });
    // a mounted edge that had focus takes it back (an edge moving to another render level's layer
    // mounts again there), once its new layer is in the document: Vue calls the ref before it
    // inserts a new parent
    const ref = elementRef(
        (element) => {
            const engine = context.engine.value;
            if (engine) {
                void nextTick(() => engine.adapter.refocus(element));
            }
            return undefined;
        },
        () => [context.engine.value],
    );
    return () => {
        const current = state.value;
        // the engine, read here: once it is there, the element patches and its ref sees it
        context.engine.value;
        if (!current.path) return null;
        return renderElement({
            tag: "g",
            as: props.as,
            attrs,
            render: slots.render,
            state: current,
            ref,
            props: { ...own.value },
            style: EDGE_STYLE,
            children: () =>
                slots.default ? slots.default({ state: current }) : h(EdgePath),
        });
    };
});
