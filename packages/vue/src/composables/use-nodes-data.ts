import {
    type AnyTypes,
    type FlowTypes,
    type NodeData,
    sameFlowValue,
} from "@fragiola/flow";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * A node's id, type and data (`nodes-data-by`), as a computed ref, or null while it does not
 * exist; given several ids, each existing one's in the order given. It changes only when one of
 * them changes (its type or its data, compared by value), not when a node moves or another
 * changes. The ids may be a ref or a getter.
 */
export function useNodesData<T extends FlowTypes = AnyTypes>(
    nodeId: MaybeRefOrGetter<string>,
): ComputedRef<NodeData<T> | null>;
export function useNodesData<T extends FlowTypes = AnyTypes>(
    nodeIds: MaybeRefOrGetter<readonly string[]>,
): ComputedRef<readonly NodeData<T>[]>;
export function useNodesData<T extends FlowTypes = AnyTypes>(
    ids: MaybeRefOrGetter<string | readonly string[]>,
): ComputedRef<NodeData<T> | null | readonly NodeData<T>[]> {
    const context = useFlowContext("useNodesData");
    const list = useFlowValue(
        context,
        () => {
            const value = toValue(ids);
            return context.model.get("nodes-data-by", {
                nodeIds: typeof value === "string" ? [value] : [...value],
            }) as readonly NodeData<T>[];
        },
        sameFlowValue,
    );
    // one id: its entry (the list keeps its object while equal, so does the entry)
    return computed(() =>
        typeof toValue(ids) === "string" ? (list.value[0] ?? null) : list.value,
    );
}
