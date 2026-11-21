import type { AnyTypes, FlowNode, FlowTypes } from "@fragiola/flow";
import * as React from "react";
import { NodeContext } from "../context";
import { type NodeState, useNode } from "../hooks/use-node";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface NodeProps<T extends FlowTypes = AnyTypes>
    extends DivPrimitiveProps<NodeState<T>> {
    /** the node it renders: the one `Flow.Nodes` gives its children function */
    node: FlowNode<T>;
    children?: React.ReactNode;
}

/**
 * One node (`data-flow-part="node"`, `data-flow-id`), absolutely positioned at its place in the
 * viewport (a structural `transform`), registered with the engine, which measures it and resolves
 * presses on it (drag, select, connect from its handles). It renders only its children: the
 * content, `Flow.Handle`s, a resizer, a toolbar.
 */
export function Node<T extends FlowTypes = AnyTypes>(props: NodeProps<T>) {
    const { node, children, ...rest } = props;
    const { state, props: own } = useNode<T>(node);
    const { ref, style, ...attributes } = own;
    const context = React.useMemo(() => ({ nodeId: node.id }), [node.id]);
    const element = useRenderElement("div", rest, {
        state,
        ref: ref as React.Ref<Element>,
        props: { ...attributes, children },
        style,
    });
    return (
        <NodeContext.Provider value={context}>{element}</NodeContext.Provider>
    );
}
