import { computed, type Signal } from "@angular/core";
import {
    type AnyTypes,
    type FlowTypes,
    type NodeData,
    sameFlowValue,
} from "@fragiola/flow";
import { injectFlowContext } from "../context";
import { flowValue, type ValueOrSignal, valueNow } from "./internal";

/**
 * A node's id, type and data (`nodes-data-by`), or null while it does not exist; given several
 * ids, each existing one's in the order given (React's `useNodesData`). The signal changes only
 * when one of them does (its type or its data, compared by value), not when a node moves or another
 * changes. The ids are a value, a signal or a getter (an input is followed). Call it in an
 * injection context (a constructor or a field).
 */
export function injectNodesData<T extends FlowTypes = AnyTypes>(
    nodeId: ValueOrSignal<string>,
): Signal<NodeData<T> | null>;
export function injectNodesData<T extends FlowTypes = AnyTypes>(
    nodeIds: ValueOrSignal<readonly string[]>,
): Signal<readonly NodeData<T>[]>;
export function injectNodesData<T extends FlowTypes = AnyTypes>(
    ids: ValueOrSignal<string | readonly string[]>,
): Signal<NodeData<T> | null | readonly NodeData<T>[]> {
    const context = injectFlowContext("injectNodesData");
    const asked = computed(() => valueNow(ids));
    const list = flowValue(
        context,
        () => {
            const now = asked();
            if (now === undefined) return [];
            return context.model().get("nodes-data-by", {
                nodeIds: typeof now === "string" ? [now] : now,
            }) as readonly NodeData<T>[];
        },
        sameFlowValue,
    );
    return computed(() =>
        typeof asked() === "string" ? (list()[0] ?? null) : list(),
    );
}
