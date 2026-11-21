import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import { defineComponent, h, type PropType, type Slot } from "vue";
import { useFlowValue } from "../composables/internal";
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

const NODES_STYLE = { position: "absolute", top: "0", left: "0" };

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

/**
 * The layer of the nodes (`data-flow-part="nodes"`), inside `Flow.Viewport`: renders its default
 * slot for each node that is not hidden (with `onlyRenderVisible`, each one in view,
 * `visible-nodes`), in drawing order, keyed by its id (a node keeps its element when it moves).
 * You render each node.
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
        return engine?.adapter.settings.onlyRenderVisible
            ? engine.get("visible-nodes")
            : model.get("all-nodes").filter((node) => node.hidden !== true);
    });
    return () => {
        const nodes = list.value;
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: { count: nodes.length },
            props: { ...partAttributes("nodes") },
            style: NODES_STYLE,
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
