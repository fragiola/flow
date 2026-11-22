import { computed, isSignal, type Signal } from "@angular/core";
import {
    type HandleType,
    type NodeConnection,
    sameFlowValue,
} from "@fragiola/flow";
import { injectFlowContext, injectNodeContext } from "../context";
import {
    flowValue,
    partOwnerId,
    type ValueOrSignal,
    valueNow,
} from "./internal";

export interface InjectNodeConnectionsOptions {
    /** the node; default the enclosing `[flowNode]`'s */
    id?: string | undefined;
    /** only the connections at this handle of it */
    handleId?: string | undefined;
    /** only those that start (`"source"`) or end (`"target"`) at it */
    type?: HandleType | undefined;
}

/**
 * The connections at a node (`node-connections-by`, React's `useNodeConnections`): each edge that
 * starts or ends at it, as its `edgeId`, `source`, `sourceHandle`, `target` and `targetHandle`, in
 * the document's order. The signal changes only when they do (an edge added, removed or
 * reconnected there), not when a node moves or an edge's data changes. The options are a value, a
 * signal or a getter; outside `[flowNode]` they need an `id` (reported once rendered). Call it in
 * an injection context (a constructor or a field).
 */
export function injectNodeConnections(
    options: ValueOrSignal<InjectNodeConnectionsOptions> = {},
): Signal<readonly NodeConnection[]> {
    const context = injectFlowContext("injectNodeConnections");
    const around = injectNodeContext();
    // options given as a value are known now (React's error); a signal's once rendered
    if (
        !around &&
        !isSignal(options) &&
        typeof options !== "function" &&
        options.id === undefined
    ) {
        throw new Error(
            "injectNodeConnections must be called inside [flowNode] (or be given an id)",
        );
    }
    const given = computed(() => valueNow(options));
    const nodeId = partOwnerId(
        "injectNodeConnections",
        () => given()?.id,
        around,
        "node",
    );
    return flowValue(
        context,
        () => {
            const id = nodeId();
            if (id === undefined) return [];
            const { handleId, type } = given() ?? {};
            return context.model().get("node-connections-by", {
                nodeId: id,
                handleId,
                handleType: type,
            });
        },
        sameFlowValue,
    );
}
