import {
    type AnyTypes,
    type FlowTypes,
    type InternalNode,
    sameFlowValue,
} from "@fragiola/flow";
import type { ComputedRef, MaybeRefOrGetter } from "vue";
import { toValue } from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * A node as the engine knows it on screen (`internal-node-by`), as a computed ref: the document's
 * node, its absolute position and box (`nodeOrigin` applied), whether its size is known, its
 * z-index and its handles with their centres; undefined while it does not exist or before the root
 * is mounted. It changes only when one of them changes (compared by value): a pan does not. The
 * id may be a ref or a getter.
 */
export function useInternalNode<T extends FlowTypes = AnyTypes>(
    nodeId: MaybeRefOrGetter<string>,
): ComputedRef<InternalNode<T> | undefined> {
    const context = useFlowContext("useInternalNode");
    return useFlowValue(
        context,
        () =>
            context.engine.value?.get("internal-node-by", {
                nodeId: toValue(nodeId),
            }) as InternalNode<T> | undefined,
        sameFlowValue,
    );
}
