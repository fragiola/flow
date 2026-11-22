import {
    type HandleType,
    type NodeConnection,
    sameFlowValue,
} from "@fragiola/flow";
import { findNodeContext, useFlowContext } from "../context.js";
import {
    type FlowValue,
    flowValue,
    type MaybeGetter,
    read,
} from "./internal.svelte.js";

export interface UseNodeConnectionsOptions {
    /** the node; default the enclosing `Flow.Node`'s */
    id?: string | undefined;
    /** only the connections at this handle of it */
    handleId?: string | undefined;
    /** only those that start (`"source"`) or end (`"target"`) at it */
    type?: HandleType | undefined;
}

/**
 * The connections at a node (`node-connections-by`) as `current`: each edge that starts or ends
 * at it, as its `edgeId`, `source`, `sourceHandle`, `target` and `targetHandle`, in the document's
 * order. Pass the options, or a getter of them, to follow a prop. It notifies its readers only
 * when they change (an edge added, removed or reconnected there), not when a node moves or an
 * edge's data changes. Outside a `Flow.Node` it needs an `id` (it throws without one).
 */
export function useNodeConnections(
    options: MaybeGetter<UseNodeConnectionsOptions> = {},
): FlowValue<readonly NodeConnection[]> {
    const context = useFlowContext("useNodeConnections");
    const enclosing = findNodeContext();
    const nodeIdOf = (): string => {
        const nodeId = read(options).id ?? enclosing?.nodeId;
        if (nodeId === undefined) {
            throw new Error(
                "useNodeConnections must be called inside Flow.Node (or be given an id)",
            );
        }
        return nodeId;
    };
    nodeIdOf();
    return flowValue(
        context,
        () => {
            const { handleId, type } = read(options);
            return context.model.get("node-connections-by", {
                nodeId: nodeIdOf(),
                handleId,
                handleType: type,
            });
        },
        sameFlowValue,
    );
}
