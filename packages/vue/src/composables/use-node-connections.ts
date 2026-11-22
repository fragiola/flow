import {
    type HandleType,
    type NodeConnection,
    sameFlowValue,
} from "@fragiola/flow";
import { type ComputedRef, inject, type MaybeRefOrGetter, toValue } from "vue";
import { NodeKey, useFlowContext } from "../context";
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
 * The connections at a node (`node-connections-by`), as a computed ref: each edge that starts or
 * ends at it, as its `edgeId`, `source`, `sourceHandle`, `target` and `targetHandle`, in the
 * document's order. It changes only when they change (an edge added, removed or reconnected
 * there), not when a node moves or an edge's data changes. The options may be a ref or a getter;
 * outside a `Flow.Node`, give an `id`.
 */
export function useNodeConnections(
    options: MaybeRefOrGetter<UseNodeConnectionsOptions> = {},
): ComputedRef<readonly NodeConnection[]> {
    const context = useFlowContext("useNodeConnections");
    const node = inject(NodeKey, null);
    const nodeIdOf = () => {
        const id = toValue(options).id ?? node?.nodeId();
        if (id === undefined) {
            throw new Error(
                "useNodeConnections must be called inside Flow.Node (or be given an id)",
            );
        }
        return id;
    };
    // thrown in `setup`, as React's, rather than at the first read
    nodeIdOf();
    return useFlowValue(
        context,
        () => {
            const { handleId, type } = toValue(options);
            return context.model.get("node-connections-by", {
                nodeId: nodeIdOf(),
                handleId,
                handleType: type,
            });
        },
        sameFlowValue,
    );
}
