import {
    type HandleType,
    type NodeConnection,
    sameFlowValue,
} from "@fragiola/flow";
import * as React from "react";
import { NodeContext, useFlowContext } from "../context";
import { useFlowValue } from "./internal";

export interface UseNodeConnectionsOptions {
    /** the node; default the enclosing `Flow.Node`'s */
    id?: string | undefined;
    /** only the connections at this handle of it */
    handleId?: string | undefined;
    /** only those that start (`"source"`) or end (`"target"`) at it */
    type?: HandleType | undefined;
}

/**
 * The connections at a node (`node-connections-by`): each edge that starts or ends at it, as its
 * `edgeId`, `source`, `sourceHandle`, `target` and `targetHandle`, in the document's order. It
 * re-renders the component only when they change (an edge added, removed or reconnected there),
 * not when a node moves or an edge's data changes.
 */
export function useNodeConnections(
    options: UseNodeConnectionsOptions = {},
): readonly NodeConnection[] {
    const { model } = useFlowContext("useNodeConnections");
    const enclosing = React.useContext(NodeContext)?.nodeId;
    const nodeId = options.id ?? enclosing;
    if (nodeId === undefined) {
        throw new Error(
            "useNodeConnections must be called inside Flow.Node (or be given an id)",
        );
    }
    const { handleId, type } = options;
    return useFlowValue(
        model,
        null,
        () =>
            model.get("node-connections-by", {
                nodeId,
                handleId,
                handleType: type,
            }),
        sameFlowValue,
    );
}
