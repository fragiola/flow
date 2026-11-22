import {
    type AnyTypes,
    type FlowTypes,
    type NodeData,
    sameFlowValue,
} from "@fragiola/flow";
import { useFlowContext } from "../context.js";
import { plain } from "../utils/plain.svelte.js";
import {
    type FlowValue,
    flowValue,
    type MaybeGetter,
    read,
} from "./internal.svelte.js";

/**
 * A node's id, type and data (`nodes-data-by`) as `current`, or null while it does not exist;
 * given several ids, each existing one's in the order given. Pass the id, or a getter of it
 * (`useNodesData(() => id)`) to follow a prop. It notifies its readers only when one of them
 * changes (its type or its data, compared by value), not when a node moves or another changes.
 */
export function useNodesData<T extends FlowTypes = AnyTypes>(
    nodeId: MaybeGetter<string>,
): FlowValue<NodeData<T> | null>;
export function useNodesData<T extends FlowTypes = AnyTypes>(
    nodeIds: MaybeGetter<readonly string[]>,
): FlowValue<readonly NodeData<T>[]>;
export function useNodesData<T extends FlowTypes = AnyTypes>(
    ids: MaybeGetter<string | readonly string[]>,
): FlowValue<NodeData<T> | null | readonly NodeData<T>[]> {
    const context = useFlowContext("useNodesData");
    const list = flowValue(
        context,
        () => {
            const given = read(ids);
            return context.model.get("nodes-data-by", {
                nodeIds: typeof given === "string" ? [given] : plain(given),
            }) as readonly NodeData<T>[];
        },
        sameFlowValue,
    );
    return {
        get current() {
            return typeof read(ids) === "string"
                ? (list.current[0] ?? null)
                : list.current;
        },
    };
}
