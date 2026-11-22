import {
    type AnyTypes,
    type FlowNode,
    type FlowTypes,
    partAttributes,
} from "@fragiola/flow";
import * as React from "react";
import { useFlowContext } from "../context";
import { useFlowValue } from "../hooks/internal";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface NodesState {
    /** how many nodes are rendered */
    count: number;
}

export interface NodesProps<T extends FlowTypes = AnyTypes>
    extends Omit<DivPrimitiveProps<NodesState>, "children"> {
    /**
     * renders one node: usually a `Flow.Node` with its content and handles. A new function re-renders every
     * one: keep it stable (a module function, `useCallback`) when the app re-renders on each
     * change (controlled `nodes` / `edges`)
     */
    children: (node: FlowNode<T>) => React.ReactNode;
}

// its own stacking context: the nodes' z-index (a selected one raised) orders them among
// themselves, never above what follows the layer (the connection line)
const NODES_STYLE: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    isolation: "isolate",
};

interface NodeSlotProps {
    node: FlowNode;
    render: (node: FlowNode) => React.ReactNode;
}

// one node's rendering, again only when its node (or the children function) changes: a drag step
// re-renders the moved nodes only (the model shares the nodes it did not change)
const NodeSlot = React.memo(function NodeSlot({ node, render }: NodeSlotProps) {
    return render(node);
});

/**
 * The layer of the nodes (`data-flow-part="nodes"`), inside `Flow.Viewport`: calls `children` for
 * each node that is not hidden (with `onlyRenderVisible`, each one in view, `visible-nodes`), in
 * drawing order, keyed by its id (a node keeps its element when it moves). You render each node.
 */
export function Nodes<T extends FlowTypes = AnyTypes>(props: NodesProps<T>) {
    const { children, ...rest } = props;
    const { model, engine } = useFlowContext("Nodes");
    const list = useFlowValue(model, engine, () =>
        engine?.adapter.settings.onlyRenderVisible
            ? engine.get("visible-nodes")
            : model.get("all-nodes").filter((node) => node.hidden !== true),
    );
    const render = children as unknown as (node: FlowNode) => React.ReactNode;
    return useRenderElement("div", rest, {
        state: { count: list.length },
        props: {
            ...partAttributes("nodes"),
            children: list.map((node) => (
                <NodeSlot key={node.id} node={node} render={render} />
            )),
        },
        style: NODES_STYLE,
    });
}
