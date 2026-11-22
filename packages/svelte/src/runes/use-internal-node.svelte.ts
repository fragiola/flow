import {
    type AnyTypes,
    type FlowTypes,
    type InternalNode,
    sameFlowValue,
} from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import {
    type FlowValue,
    flowValue,
    type MaybeGetter,
    read,
} from "./internal.svelte.js";

/**
 * A node as the engine knows it on screen (`internal-node-by`) as `current`: the document's node,
 * its absolute position and box (`nodeOrigin` applied), whether its size is known, its z-index and
 * its handles with their centres; undefined while it does not exist or before the root is
 * mounted. Pass the id, or a getter of it, to follow a prop. It notifies its readers only when
 * one of them changes (compared by value): a pan does not.
 */
export function useInternalNode<T extends FlowTypes = AnyTypes>(
    nodeId: MaybeGetter<string>,
): FlowValue<InternalNode<T> | undefined> {
    const context = useFlowContext("useInternalNode");
    return flowValue(
        context,
        () =>
            context.engine?.get("internal-node-by", {
                nodeId: read(nodeId),
            }) as InternalNode<T> | undefined,
        sameFlowValue,
    );
}
