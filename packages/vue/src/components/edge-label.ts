import type { EdgePath } from "@fragiola/flow";
import { inject, onScopeDispose, shallowRef } from "vue";
import { useFlowValue } from "../composables/internal";
import { useEdgePath } from "../composables/use-edge";
import { EdgeLabelLayerKey, useEdgeId, useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { onClient, px, type RenderSlot, renderElement } from "../utils/render";

export interface EdgeLabelState {
    readonly edgeId: string;
    /** the edge's path, label point and ends */
    readonly path: EdgePath;
    /** `data-selected` (`selection()`) */
    readonly selected: boolean;
}

export interface EdgeLabelProps extends PrimitiveProps {
    /** the edge; default the enclosing `Flow.Edge`'s */
    edgeId?: string | undefined;
}

export interface EdgeLabelSlots extends RenderSlot<EdgeLabelState> {
    default?: SlotFunction<{ state: EdgeLabelState }>;
}

let nextLabelKey = 0;

/**
 * An edge's label (`data-flow-part="edge-label"`): HTML, centred on the path's label point in
 * flow coordinates, in the HTML layer of `Flow.Edges` (SVG holds no HTML: it renders there, not
 * where it is written). It renders only its default slot; a press on it selects its edge.
 */
export const EdgeLabel: FlowComponent<EdgeLabelProps, EdgeLabelSlots> =
    definePrimitive<EdgeLabelProps, EdgeLabelSlots>(
        "EdgeLabel",
        ["edgeId", "as"],
        (props, { attrs, slots }) => {
            const context = useFlowContext("EdgeLabel");
            const edgeId = useEdgeId("EdgeLabel", () => props.edgeId);
            const layer = inject(EdgeLabelLayerKey, null);
            const path = useEdgePath(context, edgeId);
            const attributes = useFlowValue(context, () =>
                context.engine.value?.adapter.attributes("edge-label", {
                    edgeId: edgeId(),
                }),
            );
            const version = shallowRef(0);
            // the label's element, rendered by the layer
            const render = () => {
                const current = path.value;
                const own = attributes.value;
                if (!current || !own) return null;
                const state: EdgeLabelState = {
                    edgeId: edgeId(),
                    path: current,
                    selected: own["data-selected"] !== undefined,
                };
                const { x, y } = current.label;
                return renderElement({
                    tag: "div",
                    as: props.as,
                    attrs,
                    render: slots.render,
                    state,
                    props: { ...own },
                    style: {
                        position: "absolute",
                        top: "0",
                        left: "0",
                        transform: `translate(${px(x)}, ${px(y)}) translate(-50%, -50%)`,
                        pointerEvents: "all",
                    },
                    children: () => slots.default?.({ state }),
                });
            };
            onClient(() => {
                if (!layer) return;
                const remove = layer.add({
                    key: nextLabelKey++,
                    edgeId,
                    render,
                    version,
                });
                onScopeDispose(remove);
            });
            // its attributes and slots are not reactive: a change renders the label again (written,
            // never read here, so this render does not depend on it)
            let renders = 0;
            return () => {
                version.value = ++renders;
                return null;
            };
        },
    );
