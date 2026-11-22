import {
    type AnyTypes,
    type FlowTypes,
    type NodeData,
    sameFlowValue,
} from "@fragiola/flow";
import { useFlowContext } from "../context";
import { useFlowValue } from "./internal";

/**
 * A node's id, type and data (`nodes-data-by`), or null while it does not exist; given several
 * ids, each existing one's in the order given. It re-renders the component only when one of them
 * changes (its type or its data, compared by value), not when a node moves or another changes.
 */
export function useNodesData<T extends FlowTypes = AnyTypes>(
    nodeId: string,
): NodeData<T> | null;
export function useNodesData<T extends FlowTypes = AnyTypes>(
    nodeIds: readonly string[],
): readonly NodeData<T>[];
export function useNodesData<T extends FlowTypes = AnyTypes>(
    ids: string | readonly string[],
): NodeData<T> | null | readonly NodeData<T>[] {
    const { model } = useFlowContext("useNodesData");
    const one = typeof ids === "string";
    const list = useFlowValue(
        model,
        null,
        () =>
            model.get("nodes-data-by", {
                nodeIds: one ? [ids] : ids,
            }) as readonly NodeData<T>[],
        sameFlowValue,
    );
    return one ? (list[0] ?? null) : list;
}
