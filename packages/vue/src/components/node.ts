import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import { provide } from "vue";
import { type NodeState, useNode } from "../composables/use-node";
import { NodeKey } from "../context";
import {
    definePrimitive,
    type FlowComponent,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { type RenderSlot, renderElement } from "../utils/render";

export interface NodeProps<T extends FlowTypes = AnyTypes>
    extends PrimitiveProps {
    /** the node it renders: the one `Flow.Nodes` gives its slot */
    node: FlowNode<T>;
}

export interface NodeSlots<T extends FlowTypes = AnyTypes>
    extends RenderSlot<NodeState<T>> {
    /** the node's content: `Flow.Handle`s, a resizer, a toolbar */
    default?: SlotFunction<{ state: NodeState<T> }>;
}

/**
 * One node (`data-flow-part="node"`, `data-flow-id`), absolutely positioned at its place in the
 * viewport (a structural `transform`), registered with the engine, which measures it and resolves
 * presses on it (drag, select, connect from its handles). It renders only its default slot: the
 * content, `Flow.Handle`s, a resizer, a toolbar.
 */
export const Node: FlowComponent<NodeProps, NodeSlots> = definePrimitive<
    NodeProps,
    NodeSlots
>("Node", ["node", "as"], (props, { attrs, slots }) => {
    const { state, props: own } = useNode(() => props.node);
    provide(NodeKey, { nodeId: () => props.node.id });
    return () => {
        const current = state.value;
        const { ref, style, ...attributes } = own.value;
        return renderElement({
            tag: "div",
            as: props.as,
            attrs,
            render: slots.render,
            state: current,
            ref,
            props: attributes,
            style,
            children: () => slots.default?.({ state: current }),
        });
    };
});
