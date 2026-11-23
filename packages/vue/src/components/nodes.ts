import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import { defineComponent, h, type PropType, type Slot } from "vue";
import { useDrawnLayers, useFlowValue } from "../composables/internal";
import { useFlowContext } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface NodesState {
    /** how many nodes are rendered */
    count: number;
}

export interface NodesProps extends PrimitiveProps {}

export interface NodesSlots<T extends FlowTypes = AnyTypes>
    extends RenderSlot<NodesState> {
    /**
     * renders one node (`v-slot="{ node }"`): usually a `Flow.Node` with its content and handles.
     * Each node's slot renders again when its node changes, or a reactive value it reads does
     */
    default?: SlotFunction<{ node: FlowNode<T> }>;
}

// one render level: its own stacking context, the nodes' z-index (a selected one raised) orders
// them among themselves, never above what follows the layer (the connection line)
const NODES_STYLE = {
    position: "absolute",
    top: "0",
    left: "0",
    isolation: "isolate",
};

// several levels: no stacking context of its own, so the nodes' (negative) z-indexes interleave
// with the edges' layers (`render-layers`), still below what follows
const LAYERED_NODES_STYLE = { position: "absolute", top: "0", left: "0" };

/**
 * One node's rendering, again only when its node changes (the model shares the nodes a command
 * did not change: a drag step renders the moved nodes only), when a reactive value its slot reads
 * does, or when the slot is a new one.
 */
const NodeSlot = defineComponent({
    name: "FlowNodeSlot",
    props: {
        node: { type: Object as PropType<FlowNode>, required: true },
        // the slot itself: a new one (a render function's, or a slot that reads an outer slot's
        // scope) renders every entity again, a compiled template's stays the same
        slot: { type: Function as PropType<Slot>, required: false },
    },
    setup(props) {
        return () => props.slot?.({ node: props.node });
    },
});

const NO_NODES: readonly FlowNode[] = Object.freeze([]);

function shownNodes(nodes: readonly FlowNode[]): readonly FlowNode[] {
    return nodes.filter((node) => node.hidden !== true);
}

/**
 * The layer of the nodes (`data-flow-part="nodes"`), inside `Flow.Viewport`: renders its default
 * slot for each node that is not hidden (with `onlyRenderVisible`, each one in view,
 * `visible-nodes`; with it, none before the engine knows the view: the server render and the
 * first client render), in drawing order, keyed by its id (a node keeps its element when it moves).
 * You render each node. It is its own stacking context (`isolation`), but while some edges stand
 * above nodes (several `render-layers`), when the nodes' z-indexes interleave with the edges'
 * layers.
 *
 * ```vue
 * <Flow.Nodes v-slot="{ node }"><Flow.Node :node="node">…</Flow.Node></Flow.Nodes>
 * ```
 */
export const Nodes: FlowComponent<NodesProps, NodesSlots> = definePrimitive<
    NodesProps,
    NodesSlots
>("Nodes", ["as"], (props, { attrs, slots }) => {
    const context = useFlowContext("Nodes");
    const { model } = context;
    const list = useFlowValue(context, () => {
        const engine = context.engine.value;
        if (!engine) {
            // before the engine, a culled flow renders none: the view is not known yet
            return context.onlyRenderVisible.value
                ? NO_NODES
                : shownNodes(model.get("all-nodes"));
        }
        return engine.adapter.settings.onlyRenderVisible
            ? engine.get("visible-nodes")
            : shownNodes(model.get("all-nodes"));
    });
    const layers = useDrawnLayers(context);
    return () => {
        const nodes = list.value;
        const layered = layers.value.length > 1;
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: { count: nodes.length },
            props: { ...partAttributes("nodes") },
            style: layered ? LAYERED_NODES_STYLE : NODES_STYLE,
            children: () =>
                nodes.map((node) =>
                    h(NodeSlot, {
                        key: node.id,
                        node,
                        slot: slots.default as Slot | undefined,
                    }),
                ),
        });
    };
});
